import { and, eq, ne, notInArray, sql } from 'drizzle-orm';
import { db, schema, type Tx } from '../../db';
import type { OrderStatus } from '../../db/schema';
import { badRequest, notFound } from '../../utils/errors';
import { logger } from '../../lib/logger';
import { getSettings } from '../settings/settings.service';
import { notifyAsync } from '../notifications/notify';
import { cancelReminders, scheduleReminder } from '../notifications/reminders.service';
import { releaseStock } from './pricing.service';
import { refundPayment } from '../payments/razorpay';
import { normalizePhone } from '../../utils/format';

const { orders, orderItems, orderStatusHistory, users, loyaltyTransactions, couponRedemptions, coupons, products } = schema;
type Order = typeof orders.$inferSelect;

/** Allowed manual transitions (admin panel). */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED', 'FAILED'],
  CONFIRMED: ['PROCESSING', 'PACKED', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['PACKED', 'SHIPPED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'SHIPPED', 'RETURNED'],
  DELIVERED: ['RETURN_REQUESTED', 'RETURNED', 'REFUNDED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED', 'REFUNDED'],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
  CANCELLED: [],
  FAILED: [],
};

/** Delivery phone from the order is the best contact for shipment updates. */
const contact = (o: Order) => ({ phone: normalizePhone(o.shippingAddress.phone) });

const fmtAddress = (a: Order['shippingAddress']) => [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');

async function itemsOf(orderId: string, tx: Tx = db) {
  return tx.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });
}

function orderData(o: Order, extra: Record<string, unknown> = {}) {
  return {
    orderNumber: o.orderNumber,
    total: o.total,
    paymentMethod: o.paymentMethod,
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    expectedDeliveryAt: o.expectedDeliveryAt,
    address: fmtAddress(o.shippingAddress),
    ...extra,
  };
}

/** Called once an order is placed (COD) or paid (online). */
export async function onOrderConfirmed(orderId: string) {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) return;
  const items = await itemsOf(orderId);
  await cancelReminders(orderId, ['PAYMENT_PENDING']);

  // Sales counters
  for (const i of items) await db.update(products).set({ soldCount: sql`${products.soldCount} + ${i.quantity}` }).where(eq(products.id, i.productId));

  notifyAsync({
    template: 'ORDER_CONFIRMED',
    data: orderData(o, { items: items.map((i) => ({ name: i.name, variantTitle: i.variantTitle, quantity: i.quantity, total: i.total })) }),
    channels: ['EMAIL', 'SMS', 'WHATSAPP'],
    userId: o.userId,
    orderId,
    to: contact(o),
  });
}

interface TransitionOpts {
  note?: string;
  actorId?: string | null;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  expectedDeliveryAt?: Date;
  notify?: boolean;
  /** Skip the TRANSITIONS check (system events like webhooks). */
  force?: boolean;
}

export async function transitionOrder(orderId: string, to: OrderStatus, opts: TransitionOpts = {}) {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) throw notFound('Order');
  if (o.status === to && !opts.trackingNumber) return o;
  if (!opts.force && !TRANSITIONS[o.status].includes(to)) throw badRequest(`Cannot change order from ${o.status} to ${to}`);

  const now = new Date();
  const patch: Partial<Order> = { status: to };
  if (opts.carrier) patch.carrier = opts.carrier;
  if (opts.trackingNumber) patch.trackingNumber = opts.trackingNumber;
  if (opts.trackingUrl) patch.trackingUrl = opts.trackingUrl;
  if (opts.expectedDeliveryAt) patch.expectedDeliveryAt = opts.expectedDeliveryAt;
  if (to === 'SHIPPED' && !o.shippedAt) patch.shippedAt = now;
  if (to === 'OUT_FOR_DELIVERY') patch.outForDeliveryAt = now;
  if (to === 'DELIVERED') {
    patch.deliveredAt = now;
    if (o.paymentMethod === 'COD') patch.paymentStatus = 'PAID';
  }
  if (to === 'SHIPPED' && !(opts.carrier ?? o.carrier)) throw badRequest('Courier name is required to mark an order as shipped');

  const updated = await db.transaction(async (tx) => {
    const [u] = await tx.update(orders).set(patch).where(eq(orders.id, orderId)).returning();
    await tx.insert(orderStatusHistory).values({ orderId, status: to, note: opts.note ?? defaultNote(to, u), createdById: opts.actorId ?? null });
    return u;
  });

  await sideEffects(o, updated, opts);
  return updated;
}

function defaultNote(to: OrderStatus, o: Order) {
  if (to === 'SHIPPED') return `Shipped via ${o.carrier}${o.trackingNumber ? ` (${o.trackingNumber})` : ''}`;
  return null;
}

async function sideEffects(before: Order, o: Order, opts: TransitionOpts) {
  const s = await getSettings();
  const send = opts.notify !== false;
  const data = orderData(o);
  try {
    switch (o.status) {
      case 'CONFIRMED':
        if (before.status === 'PENDING_PAYMENT') await onOrderConfirmed(o.id);
        break;
      case 'SHIPPED':
        if (send) notifyAsync({ template: 'ORDER_SHIPPED', data, channels: ['EMAIL', 'SMS', 'WHATSAPP'], userId: o.userId, orderId: o.id, to: contact(o) });
        // Tracking is handled by the courier; we nudge the customer to check it.
        await scheduleReminder({ type: 'TRACKING_REMINDER', orderId: o.id, userId: o.userId, runAt: new Date(Date.now() + s.trackingReminderHours * 3_600_000) });
        await scheduleReminder({ type: 'DELIVERY_FOLLOWUP', orderId: o.id, userId: o.userId, runAt: new Date((o.expectedDeliveryAt ?? new Date(Date.now() + 5 * 86_400_000)).getTime() + 86_400_000) });
        break;
      case 'OUT_FOR_DELIVERY':
        await cancelReminders(o.id, ['TRACKING_REMINDER']);
        if (send) notifyAsync({ template: 'OUT_FOR_DELIVERY', data, channels: ['SMS', 'WHATSAPP'], userId: o.userId, orderId: o.id, to: contact(o) });
        break;
      case 'DELIVERED':
        await cancelReminders(o.id, ['TRACKING_REMINDER', 'DELIVERY_FOLLOWUP']);
        if (send) notifyAsync({ template: 'ORDER_DELIVERED', data, channels: ['EMAIL', 'WHATSAPP'], userId: o.userId, orderId: o.id, to: contact(o) });
        await awardLoyalty(o);
        await scheduleReminder({ type: 'REVIEW_REQUEST', orderId: o.id, userId: o.userId, runAt: new Date(Date.now() + s.reviewRequestDelayDays * 86_400_000) });
        break;
      case 'CANCELLED':
      case 'FAILED':
        await cancelReminders(o.id);
        await rollbackOrder(before, o);
        if (send && o.status === 'CANCELLED') {
          notifyAsync({
            template: 'ORDER_CANCELLED',
            data: { ...data, reason: o.cancelReason, refund: before.paymentStatus === 'PAID' ? o.total : 0 },
            channels: ['EMAIL', 'WHATSAPP'],
            userId: o.userId,
            orderId: o.id,
            to: contact(o),
          });
        }
        break;
      case 'REFUNDED':
        if (before.paymentMethod === 'RAZORPAY' && before.paymentStatus === 'PAID') await refundOrder(o);
        else await db.update(orders).set({ paymentStatus: 'REFUNDED' }).where(eq(orders.id, o.id));
        if (send) notifyAsync({ template: 'REFUND_PROCESSED', data: { ...data, amount: o.total }, channels: ['EMAIL', 'WHATSAPP'], userId: o.userId, orderId: o.id, to: contact(o) });
        break;
      case 'RETURNED': {
        const items = await itemsOf(o.id);
        await db.transaction((tx) => releaseStock(tx, items));
        break;
      }
      default:
        break;
    }
  } catch (e) {
    logger.error(`Side effects failed for order ${o.orderNumber} → ${o.status}`, e);
  }
}

/** Undo the effects of placing an order: stock, coupon, loyalty points, refund. */
async function rollbackOrder(before: Order, o: Order) {
  const items = await itemsOf(o.id);
  await db.transaction(async (tx) => {
    await releaseStock(tx, items);
    const red = await tx.query.couponRedemptions.findFirst({ where: eq(couponRedemptions.orderId, o.id) });
    if (red) {
      await tx.delete(couponRedemptions).where(eq(couponRedemptions.id, red.id));
      await tx.update(coupons).set({ usedCount: sql`greatest(${coupons.usedCount} - 1, 0)` }).where(eq(coupons.id, red.couponId));
    }
    if (o.loyaltyPointsUsed > 0) {
      await tx.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} + ${o.loyaltyPointsUsed}` }).where(eq(users.id, o.userId));
      await tx.insert(loyaltyTransactions).values({ userId: o.userId, points: o.loyaltyPointsUsed, reason: `Refunded from cancelled order ${o.orderNumber}`, orderId: o.id });
    }
    // Sold counters only moved if the order had been confirmed
    if (before.status !== 'PENDING_PAYMENT') {
      for (const i of items) await tx.update(products).set({ soldCount: sql`greatest(${products.soldCount} - ${i.quantity}, 0)` }).where(eq(products.id, i.productId));
    }
  });
  if (before.paymentMethod === 'RAZORPAY' && before.paymentStatus === 'PAID') await refundOrder(o);
}

async function refundOrder(o: Order) {
  const ok = o.razorpayPaymentId ? await refundPayment(o.razorpayPaymentId, o.total, { orderNumber: o.orderNumber }) : false;
  await db.update(orders).set({ paymentStatus: 'REFUNDED' }).where(eq(orders.id, o.id));
  await db.insert(schema.payments).values({ orderId: o.id, provider: 'razorpay', providerPaymentId: o.razorpayPaymentId, amount: -o.total, status: 'REFUNDED', raw: { refundInitiated: ok } });
}

async function awardLoyalty(o: Order) {
  const s = await getSettings();
  const points = Math.floor(o.total / 10000) * s.loyaltyEarnPer100;
  if (points > 0 && o.loyaltyPointsEarned === 0) {
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ loyaltyPointsEarned: points }).where(eq(orders.id, o.id));
      await tx.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} + ${points}` }).where(eq(users.id, o.userId));
      await tx.insert(loyaltyTransactions).values({ userId: o.userId, points, reason: `Earned on order ${o.orderNumber}`, orderId: o.id });
    });
  }

  // Referral bonus: on the referred user's first delivered order, both get points
  const u = await db.query.users.findFirst({ where: eq(users.id, o.userId) });
  if (u?.referredById) {
    const delivered = await db.$count(orders, and(eq(orders.userId, u.id), eq(orders.status, 'DELIVERED'), ne(orders.id, o.id)));
    const already = await db.$count(loyaltyTransactions, and(eq(loyaltyTransactions.userId, u.referredById), eq(loyaltyTransactions.reason, `Referral bonus: ${u.name}`)));
    if (delivered === 0 && already === 0) {
      const bonus = s.referralBonusPoints;
      await db.transaction(async (tx) => {
        for (const [id, reason] of [
          [u.referredById!, `Referral bonus: ${u.name}`],
          [u.id, 'Welcome referral bonus'],
        ] as const) {
          await tx.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} + ${bonus}` }).where(eq(users.id, id));
          await tx.insert(loyaltyTransactions).values({ userId: id, points: bonus, reason, orderId: o.id });
        }
      });
    }
  }
}

export async function isFirstOrder(userId: string) {
  return (await db.$count(orders, and(eq(orders.userId, userId), notInArray(orders.status, ['CANCELLED', 'FAILED'])))) === 0;
}
