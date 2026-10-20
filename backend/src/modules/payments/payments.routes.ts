import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { badRequest, notFound } from '../../utils/errors';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { fetchPayment, verifyCheckoutSignature, verifyWebhookSignature } from './razorpay';
import { markPaid } from '../orders/orders.service';

const { orders } = schema;

export const paymentsRouter = Router();

paymentsRouter.get('/config', (_req, res) => {
  res.json({ razorpay: { enabled: env.razorpayEnabled, keyId: env.RAZORPAY_KEY_ID || null } });
});

/** Called by the storefront after Razorpay Checkout succeeds. */
paymentsRouter.post(
  '/razorpay/verify',
  requireAuth,
  validate({ body: z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }) }),
  ah(async (req, res) => {
    const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = req.body;
    const o = await db.query.orders.findFirst({ where: and(eq(orders.razorpayOrderId, oid), eq(orders.userId, req.user!.id)) });
    if (!o) throw notFound('Order');
    if (!verifyCheckoutSignature(oid, pid, sig)) throw badRequest('Payment verification failed. If money was deducted it will be refunded automatically.');
    const payment = await fetchPayment(pid);
    const updated = await markPaid(o, pid, (payment as any)?.method, payment);
    res.json({ ok: true, order: { id: updated.id, orderNumber: updated.orderNumber, status: updated.status } });
  }),
);

/** Development only: simulate a successful payment when Razorpay keys aren't configured. */
paymentsRouter.post(
  '/mock/confirm',
  requireAuth,
  validate({ body: z.object({ razorpayOrderId: z.string().startsWith('order_mock_') }) }),
  ah(async (req, res) => {
    if (env.isProd || env.razorpayEnabled) throw badRequest('Mock payments are disabled');
    const o = await db.query.orders.findFirst({ where: and(eq(orders.razorpayOrderId, req.body.razorpayOrderId), eq(orders.userId, req.user!.id)) });
    if (!o) throw notFound('Order');
    const updated = await markPaid(o, `pay_mock_${Date.now()}`, 'upi', { mock: true });
    res.json({ ok: true, order: { id: updated.id, orderNumber: updated.orderNumber, status: updated.status } });
  }),
);

/**
 * Razorpay webhook (configure in Dashboard → Webhooks):
 *   URL:    {API_URL}/api/payments/webhook
 *   Events: payment.captured, payment.failed, order.paid, refund.processed
 * Acts as a safety net when the browser closes before /verify is called.
 */
paymentsRouter.post(
  '/webhook',
  ah(async (req, res) => {
    const raw = req.body as Buffer;
    if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, req.get('x-razorpay-signature'))) {
      logger.warn('Rejected Razorpay webhook with invalid signature');
      return void res.status(400).json({ ok: false });
    }
    const event = JSON.parse(raw.toString('utf8'));
    const entity = event?.payload?.payment?.entity;
    try {
      if ((event.event === 'payment.captured' || event.event === 'order.paid') && entity?.order_id) {
        const o = await db.query.orders.findFirst({ where: eq(orders.razorpayOrderId, entity.order_id) });
        if (o) await markPaid(o, entity.id, entity.method, entity);
      } else if (event.event === 'payment.failed' && entity?.order_id) {
        const o = await db.query.orders.findFirst({ where: eq(orders.razorpayOrderId, entity.order_id) });
        if (o && o.paymentStatus !== 'PAID') {
          await db.insert(schema.payments).values({ orderId: o.id, provider: 'razorpay', providerOrderId: entity.order_id, providerPaymentId: entity.id, amount: entity.amount, status: 'FAILED', method: entity.method, raw: entity });
        }
      } else if (event.event === 'refund.processed') {
        const pid = event?.payload?.refund?.entity?.payment_id;
        if (pid) await db.update(orders).set({ paymentStatus: 'REFUNDED' }).where(eq(orders.razorpayPaymentId, pid));
      }
    } catch (e) {
      logger.error('Razorpay webhook processing failed', e);
    }
    res.json({ ok: true });
  }),
);
