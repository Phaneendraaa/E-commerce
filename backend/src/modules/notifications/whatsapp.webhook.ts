import crypto from 'crypto';
import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { ah } from '../../utils/http';
import { formatDate, normalizePhone } from '../../utils/format';
import { sendManualWhatsApp } from './notify';

const { notificationLogs, users, orders } = schema;

/**
 * WhatsApp Cloud API webhook.
 *   Callback URL:  {API_URL}/api/webhooks/whatsapp
 *   Verify token:  WHATSAPP_WEBHOOK_VERIFY_TOKEN
 *   Fields:        messages
 *
 * - Stores delivery/read receipts against notification_logs.
 * - Auto-replies to customers who message "track", "status" or "order" with
 *   their latest order status and courier tracking link.
 * - "STOP" opts the customer out of WhatsApp updates, "START" opts back in.
 */
export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get('/', (req, res) => {
  const ok = req.query['hub.mode'] === 'subscribe' && env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && req.query['hub.verify_token'] === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (ok) return void res.status(200).send(String(req.query['hub.challenge']));
  res.sendStatus(403);
});

function validSignature(raw: Buffer, header?: string) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // optional hardening — set WHATSAPP_APP_SECRET to enforce
  if (!header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const got = header.slice(7);
  return expected.length === got.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'waiting for payment',
  CONFIRMED: 'confirmed',
  PROCESSING: 'being prepared',
  PACKED: 'packed and ready to ship',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out for delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURN_REQUESTED: 'under return',
  RETURNED: 'returned',
  REFUNDED: 'refunded',
  FAILED: 'not completed',
};

async function handleInbound(from: string, text: string) {
  const phone = normalizePhone(`+${from}`);
  if (!phone) return;
  const msg = text.trim().toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(users.phone, phone) });

  if (['stop', 'unsubscribe'].includes(msg)) {
    if (user) await db.update(users).set({ whatsappOptIn: false }).where(eq(users.id, user.id));
    await sendManualWhatsApp({ phone, text: "You've been unsubscribed from WhatsApp updates. Reply START to subscribe again.", userId: user?.id });
    return;
  }
  if (msg === 'start') {
    if (user) await db.update(users).set({ whatsappOptIn: true }).where(eq(users.id, user.id));
    await sendManualWhatsApp({ phone, text: "You're subscribed to order updates on WhatsApp ✅", userId: user?.id });
    return;
  }

  if (/(track|status|order|where|delivery)/.test(msg)) {
    if (!user) {
      await sendManualWhatsApp({ phone, text: `We couldn't find an account with this number. Track any order at ${env.FRONTEND_URL}/track-order` });
      return;
    }
    const o = await db.query.orders.findFirst({ where: eq(orders.userId, user.id), orderBy: desc(orders.createdAt) });
    if (!o) {
      await sendManualWhatsApp({ phone, text: `Hi ${user.name.split(' ')[0]}, you don't have any orders yet. Browse ${env.FRONTEND_URL}`, userId: user.id });
      return;
    }
    const lines = [`Hi ${user.name.split(' ')[0]}! Your latest order *${o.orderNumber}* is *${STATUS_LABEL[o.status] ?? o.status}*.`];
    if (o.trackingNumber) lines.push(`Courier: ${o.carrier}\nTracking ID: ${o.trackingNumber}${o.trackingUrl ? `\nTrack: ${o.trackingUrl}` : ''}`);
    if (o.expectedDeliveryAt && !o.deliveredAt) lines.push(`Expected by ${formatDate(o.expectedDeliveryAt)}.`);
    lines.push(`Details: ${env.FRONTEND_URL}/account/orders/${o.orderNumber}`);
    await sendManualWhatsApp({ phone, text: lines.join('\n\n'), userId: user.id, orderId: o.id });
    return;
  }

  await sendManualWhatsApp({
    phone,
    text: `Thanks for reaching out! Reply *TRACK* to get your latest order status, or visit ${env.FRONTEND_URL}/account/orders. Our team will get back to you shortly.`,
    userId: user?.id,
  });
}

whatsappWebhookRouter.post(
  '/',
  ah(async (req, res) => {
    const raw = req.body as Buffer;
    if (!Buffer.isBuffer(raw) || !validSignature(raw, req.get('x-hub-signature-256'))) return void res.sendStatus(401);
    // Acknowledge immediately; Meta retries on slow responses
    res.sendStatus(200);

    try {
      const body = JSON.parse(raw.toString('utf8'));
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const v = change.value ?? {};
          for (const st of v.statuses ?? []) {
            await db
              .update(notificationLogs)
              .set({ deliveryStatus: st.status, ...(st.status === 'failed' ? { status: 'FAILED' as const, error: st.errors?.[0]?.title } : {}) })
              .where(eq(notificationLogs.providerMessageId, st.id));
          }
          for (const m of v.messages ?? []) {
            const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? '';
            if (m.from && text) await handleInbound(m.from, text);
          }
        }
      }
    } catch (e) {
      logger.error('WhatsApp webhook processing failed', e);
    }
  }),
);
