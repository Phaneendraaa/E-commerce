import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah, pageMeta, paging } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { badRequest } from '../../utils/errors';
import { getSettings } from '../settings/settings.service';
import { notifyAsync } from '../notifications/notify';
import { checkout, findUserOrder } from './orders.service';
import { transitionOrder } from './lifecycle';
import { streamInvoice } from './invoice';
import { getOrCreateCart } from '../cart/cart.routes';
import { createGatewayOrder } from '../payments/razorpay';
import { env } from '../../config/env';

const { orders, returnRequests, cartItems, productVariants, payments } = schema;

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const CANCELLABLE = ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING'];

const addressInput = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  landmark: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  country: z.string().optional(),
});

ordersRouter.post(
  '/checkout',
  validate({
    body: z
      .object({
        addressId: z.string().uuid().optional(),
        address: addressInput.optional(),
        saveAddress: z.boolean().default(true),
        paymentMethod: z.enum(['RAZORPAY', 'COD']),
        couponCode: z.string().trim().max(30).optional().nullable(),
        loyaltyPoints: z.number().int().min(0).optional(),
        note: z.string().trim().max(500).optional(),
        items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(10) })).max(50).optional(),
        attribution: z
          .object({ utmSource: z.string().max(60).optional(), utmMedium: z.string().max(60).optional(), utmCampaign: z.string().max(100).optional(), device: z.string().max(20).optional(), sessionId: z.string().max(80).optional() })
          .optional(),
      })
      .refine((b) => b.addressId || b.address, { message: 'A delivery address is required', path: ['address'] }),
  }),
  ah(async (req, res) => {
    const result = await checkout({ ...req.body, userId: req.user!.id });
    res.status(201).json(result);
  }),
);

ordersRouter.get(
  '/',
  validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10), status: z.string().optional() }) }),
  ah(async (req, res) => {
    const p = paging(req.query, 10, 50);
    const where = and(eq(orders.userId, req.user!.id), req.query.status ? inArray(orders.status, String(req.query.status).split(',') as any) : undefined);
    const [items, total] = await Promise.all([
      db.query.orders.findMany({ where, orderBy: desc(orders.createdAt), limit: p.limit, offset: p.skip, with: { items: { columns: { name: true, image: true, quantity: true, variantTitle: true, productId: true } } } }),
      db.$count(orders, where),
    ]);
    res.json({ items, ...pageMeta(p, total) });
  }),
);

ordersRouter.get(
  '/:id',
  ah(async (req, res) => {
    const o = await findUserOrder(req.user!.id, req.params.id);
    const s = await getSettings();
    const deliveredAt = o.deliveredAt ? new Date(o.deliveredAt).getTime() : 0;
    const returnOpen = o.status === 'DELIVERED' && deliveredAt && Date.now() - deliveredAt < s.returnWindowDays * 86_400_000 && !o.returns.some((r) => r.status !== 'REJECTED');
    res.json({
      order: {
        ...o,
        items: o.items.map(({ costPrice: _c, ...i }) => i),
        canCancel: CANCELLABLE.includes(o.status),
        canReturn: Boolean(returnOpen),
        returnWindowEndsAt: deliveredAt ? new Date(deliveredAt + s.returnWindowDays * 86_400_000) : null,
        canPay: o.status === 'PENDING_PAYMENT' && o.paymentMethod === 'RAZORPAY',
      },
    });
  }),
);

ordersRouter.post(
  '/:id/cancel',
  validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }),
  ah(async (req, res) => {
    const o = await findUserOrder(req.user!.id, req.params.id);
    if (!CANCELLABLE.includes(o.status)) throw badRequest('This order can no longer be cancelled. You can request a return after delivery.');
    await db.update(orders).set({ cancelReason: req.body.reason, cancelledAt: new Date() }).where(eq(orders.id, o.id));
    const updated = await transitionOrder(o.id, 'CANCELLED', { note: `Cancelled by customer: ${req.body.reason}`, actorId: req.user!.id });
    res.json({ order: updated, message: o.paymentStatus === 'PAID' ? 'Order cancelled. Your refund has been initiated.' : 'Order cancelled.' });
  }),
);

/** Retry payment for an unpaid online order. */
ordersRouter.post(
  '/:id/pay',
  ah(async (req, res) => {
    const o = await findUserOrder(req.user!.id, req.params.id);
    if (o.status !== 'PENDING_PAYMENT' || o.paymentMethod !== 'RAZORPAY') throw badRequest('This order does not need payment');
    const s = await getSettings();
    const gw = await createGatewayOrder(o.total, `${o.orderNumber}-r${Date.now() % 1000}`, { orderNumber: o.orderNumber });
    await db.update(orders).set({ razorpayOrderId: gw.id }).where(eq(orders.id, o.id));
    await db.insert(payments).values({ orderId: o.id, provider: 'razorpay', providerOrderId: gw.id, amount: o.total, status: 'PENDING' });
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, o.userId), columns: { name: true, email: true, phone: true } });
    res.json({
      order: { id: o.id, orderNumber: o.orderNumber, total: o.total },
      payment: { provider: 'razorpay', mock: gw.mock, keyId: env.RAZORPAY_KEY_ID || null, razorpayOrderId: gw.id, amount: o.total, currency: 'INR', name: s.storeName, description: `Order ${o.orderNumber}`, prefill: { name: u?.name, email: u?.email ?? undefined, contact: u?.phone ?? o.shippingAddress.phone } },
    });
  }),
);

ordersRouter.post(
  '/:id/return',
  validate({ body: z.object({ itemIds: z.array(z.string().uuid()).min(1), reason: z.string().trim().min(3).max(200), details: z.string().trim().max(1000).optional() }) }),
  ah(async (req, res) => {
    const o = await findUserOrder(req.user!.id, req.params.id);
    const s = await getSettings();
    if (o.status !== 'DELIVERED' || !o.deliveredAt) throw badRequest('Returns can be requested only after delivery');
    if (Date.now() - new Date(o.deliveredAt).getTime() > s.returnWindowDays * 86_400_000) throw badRequest(`The ${s.returnWindowDays}-day return window has closed for this order`);
    if (o.returns.some((r) => r.status !== 'REJECTED')) throw badRequest('A return request already exists for this order');
    const valid = new Set(o.items.map((i) => i.id));
    if (!req.body.itemIds.every((id: string) => valid.has(id))) throw badRequest('Invalid items selected');

    const refundAmount = o.items.filter((i) => req.body.itemIds.includes(i.id)).reduce((sum, i) => sum + i.total, 0);
    const [r] = await db.insert(returnRequests).values({ orderId: o.id, userId: o.userId, itemIds: req.body.itemIds, reason: req.body.reason, details: req.body.details, refundAmount: Math.min(refundAmount, o.total) }).returning();
    await transitionOrder(o.id, 'RETURN_REQUESTED', { note: `Return requested: ${req.body.reason}`, actorId: req.user!.id });
    notifyAsync({ template: 'RETURN_UPDATE', data: { orderNumber: o.orderNumber, status: 'REQUESTED', note: 'We will arrange a pickup within 2 business days.' }, channels: ['EMAIL', 'WHATSAPP'], userId: o.userId, orderId: o.id });
    res.status(201).json({ return: r, message: 'Return requested. We will arrange a pickup shortly.' });
  }),
);

ordersRouter.get(
  '/:id/invoice',
  ah(async (req, res) => {
    const o = await findUserOrder(req.user!.id, req.params.id);
    if (o.status === 'PENDING_PAYMENT' || o.status === 'FAILED') throw badRequest('Invoice is available once the order is confirmed');
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, o.userId), columns: { name: true, email: true } });
    streamInvoice(res, o, await getSettings(), u!);
  }),
);

/** Add every item of a past order back to the cart. */
ordersRouter.post(
  '/:id/reorder',
  ah(async (req, res) => {
    const o = await findUserOrder(req.user!.id, req.params.id);
    const cart = await getOrCreateCart(req.user!.id);
    let added = 0;
    for (const i of o.items) {
      const v = await db.query.productVariants.findFirst({ where: eq(productVariants.id, i.variantId), columns: { stock: true, isActive: true } });
      if (!v?.isActive || v.stock <= 0) continue;
      await db
        .insert(cartItems)
        .values({ cartId: cart.id, variantId: i.variantId, quantity: Math.min(i.quantity, v.stock) })
        .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: sql`least(${cartItems.quantity} + ${i.quantity}, 10)` } });
      added++;
    }
    res.json({ added, skipped: o.items.length - added });
  }),
);
