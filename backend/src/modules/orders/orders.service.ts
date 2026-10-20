import { and, eq, sql, type AnyColumn } from 'drizzle-orm';
import crypto from 'crypto';
import { db, schema } from '../../db';
import type { AddressSnapshot } from '../../db/schema';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { logger } from '../../lib/logger';
import { getSettings } from '../settings/settings.service';
import { buildQuote, reserveStock, type LineInput } from './pricing.service';
import { createGatewayOrder } from '../payments/razorpay';
import { onOrderConfirmed } from './lifecycle';
import { scheduleReminder } from '../notifications/reminders.service';
import { env } from '../../config/env';

const { orders, orderItems, orderStatusHistory, carts, cartItems, couponRedemptions, coupons, users, loyaltyTransactions, addresses, payments, analyticsEvents } = schema;

/** Unpaid online orders are auto-cancelled (and stock released) after this window. */
export const PAYMENT_WINDOW_MIN = 30;

export function generateOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `SN${ymd}${crypto.randomInt(100000, 999999)}`;
}

export interface CheckoutInput {
  userId: string;
  addressId?: string;
  address?: Omit<AddressSnapshot, 'country'> & { country?: string };
  saveAddress?: boolean;
  paymentMethod: 'RAZORPAY' | 'COD';
  couponCode?: string | null;
  loyaltyPoints?: number;
  note?: string;
  /** Buy-now: explicit items instead of the server cart. */
  items?: LineInput[];
  attribution?: { utmSource?: string; utmMedium?: string; utmCampaign?: string; device?: string; sessionId?: string };
}

export async function checkout(input: CheckoutInput) {
  const s = await getSettings();

  // Resolve address
  let shippingAddress: AddressSnapshot;
  if (input.addressId) {
    const a = await db.query.addresses.findFirst({ where: and(eq(addresses.id, input.addressId), eq(addresses.userId, input.userId)) });
    if (!a) throw badRequest('Please select a delivery address');
    shippingAddress = { fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pincode: a.pincode, country: a.country };
  } else if (input.address) {
    shippingAddress = { ...input.address, country: input.address.country ?? 'India' };
    if (input.saveAddress) {
      const count = await db.$count(addresses, eq(addresses.userId, input.userId));
      await db.insert(addresses).values({ ...shippingAddress, userId: input.userId, isDefault: count === 0 });
    }
  } else throw badRequest('Please provide a delivery address');

  // Resolve items
  const cart = await db.query.carts.findFirst({ where: eq(carts.userId, input.userId) });
  const fromCart = !input.items?.length;
  const lines: LineInput[] = fromCart ? (cart ? await db.query.cartItems.findMany({ where: eq(cartItems.cartId, cart.id), columns: { variantId: true, quantity: true } }) : []) : input.items!;
  if (!lines.length) throw badRequest('Your cart is empty');

  const couponCode = input.couponCode ?? (fromCart ? cart?.couponCode : null) ?? null;

  if (input.paymentMethod === 'COD' && !s.codEnabled) throw badRequest('Cash on Delivery is currently unavailable');

  const orderNumber = generateOrderNumber();

  const order = await db.transaction(async (tx) => {
    const quote = await buildQuote(lines, { userId: input.userId, couponCode, paymentMethod: input.paymentMethod, loyaltyPoints: input.loyaltyPoints, settings: s }, tx);
    if (quote.hasIssues) {
      const bad = quote.lines.find((l) => !l.available)!;
      throw conflict(`${bad.productName} (${bad.variantTitle}): ${bad.issue}. Please update your cart.`);
    }
    if (couponCode && quote.coupon && !quote.coupon.valid) throw badRequest(quote.coupon.message);
    if (input.paymentMethod === 'COD' && !quote.codAvailable) throw badRequest('Cash on Delivery is not available for this order value');

    const failed = await reserveStock(tx, quote.lines);
    if (failed) {
      const l = quote.lines.find((x) => x.variantId === failed)!;
      throw conflict(`${l.productName} just went out of stock. Please update your cart.`);
    }

    const isCod = input.paymentMethod === 'COD';
    const [o] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId: input.userId,
        status: isCod ? 'CONFIRMED' : 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        paymentMethod: input.paymentMethod,
        subtotal: quote.subtotal,
        discount: quote.discount,
        shippingFee: quote.shippingFee,
        codFee: quote.codFee,
        tax: quote.tax,
        loyaltyDiscount: quote.loyaltyDiscount,
        loyaltyPointsUsed: quote.loyaltyPointsUsed,
        total: quote.total,
        couponCode: quote.coupon?.valid ? quote.coupon.code : null,
        shippingAddress,
        customerNote: input.note,
        utmSource: input.attribution?.utmSource,
        utmMedium: input.attribution?.utmMedium,
        utmCampaign: input.attribution?.utmCampaign,
        device: input.attribution?.device,
      })
      .returning();

    await tx.insert(orderItems).values(
      quote.lines.map((l) => ({
        orderId: o.id,
        productId: l.productId,
        variantId: l.variantId,
        name: l.productName,
        variantTitle: l.variantTitle,
        sku: l.sku,
        image: l.image,
        price: l.price,
        costPrice: l.costPrice,
        quantity: l.quantity,
        total: l.total,
        taxRate: l.taxRate,
      })),
    );
    await tx.insert(orderStatusHistory).values({ orderId: o.id, status: o.status, note: isCod ? 'Order placed (Cash on Delivery)' : 'Order placed — awaiting payment' });

    if (quote.coupon?.valid && quote.coupon.couponId) {
      await tx.insert(couponRedemptions).values({ couponId: quote.coupon.couponId, userId: input.userId, orderId: o.id, discount: quote.discount });
      await tx.update(coupons).set({ usedCount: sql_inc(coupons.usedCount) }).where(eq(coupons.id, quote.coupon.couponId));
    }
    if (quote.loyaltyPointsUsed > 0) {
      await tx.update(users).set({ loyaltyPoints: sql_dec(users.loyaltyPoints, quote.loyaltyPointsUsed) }).where(eq(users.id, input.userId));
      await tx.insert(loyaltyTransactions).values({ userId: input.userId, points: -quote.loyaltyPointsUsed, reason: `Redeemed on order ${orderNumber}`, orderId: o.id });
    }
    if (fromCart && cart) {
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      await tx.update(carts).set({ couponCode: null, recoveredAt: cart.reminderCount > 0 ? new Date() : null, reminderCount: 0 }).where(eq(carts.id, cart.id));
    }
    return o;
  });

  // Payment
  let gateway: { id: string; mock: boolean } | null = null;
  if (order.paymentMethod === 'RAZORPAY') {
    try {
      gateway = await createGatewayOrder(order.total, order.orderNumber, { orderNumber: order.orderNumber });
      await db.update(orders).set({ razorpayOrderId: gateway.id }).where(eq(orders.id, order.id));
      await db.insert(payments).values({ orderId: order.id, provider: 'razorpay', providerOrderId: gateway.id, amount: order.total, status: 'PENDING' });
      await scheduleReminder({ type: 'PAYMENT_PENDING', orderId: order.id, userId: order.userId, runAt: new Date(Date.now() + 10 * 60_000) });
    } catch (e) {
      logger.error('Failed to create Razorpay order', e);
      // Roll the order back to free reserved stock
      const { transitionOrder } = await import('./lifecycle');
      await transitionOrder(order.id, 'FAILED', { force: true, notify: false, note: 'Payment gateway error' });
      throw badRequest('Payment gateway is unavailable right now. Please try again or choose Cash on Delivery.');
    }
  } else {
    await onOrderConfirmed(order.id);
    await recordPurchaseEvent(order, input.attribution?.sessionId);
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, order.userId), columns: { name: true, email: true, phone: true } });

  return {
    order: { id: order.id, orderNumber: order.orderNumber, status: order.status, total: order.total, paymentMethod: order.paymentMethod },
    payment: gateway
      ? {
          provider: 'razorpay',
          mock: gateway.mock,
          keyId: env.RAZORPAY_KEY_ID || null,
          razorpayOrderId: gateway.id,
          amount: order.total,
          currency: 'INR',
          name: s.storeName,
          description: `Order ${order.orderNumber}`,
          prefill: { name: user?.name, email: user?.email ?? undefined, contact: user?.phone ?? shippingAddress.phone },
        }
      : null,
  };
}

export async function recordPurchaseEvent(o: typeof orders.$inferSelect, sessionId?: string) {
  await db.insert(analyticsEvents).values({
    type: 'PURCHASE',
    sessionId: sessionId ?? `order_${o.id}`,
    userId: o.userId,
    value: o.total,
    device: o.device,
    utmSource: o.utmSource,
    utmMedium: o.utmMedium,
    utmCampaign: o.utmCampaign,
    meta: { orderId: o.id },
  });
}

export async function markPaid(o: typeof orders.$inferSelect, paymentId: string, method?: string, raw?: unknown) {
  if (o.paymentStatus === 'PAID') return o;
  const [updated] = await db
    .update(orders)
    .set({ paymentStatus: 'PAID', razorpayPaymentId: paymentId, status: o.status === 'PENDING_PAYMENT' || o.status === 'FAILED' ? 'CONFIRMED' : o.status })
    .where(eq(orders.id, o.id))
    .returning();
  await db.update(payments).set({ status: 'PAID', providerPaymentId: paymentId, method, raw: raw as any }).where(and(eq(payments.orderId, o.id), eq(payments.providerOrderId, o.razorpayOrderId ?? '')));
  if (o.status === 'PENDING_PAYMENT') {
    await db.insert(orderStatusHistory).values({ orderId: o.id, status: 'CONFIRMED', note: `Payment received${method ? ` via ${method.toUpperCase()}` : ''}` });
    await onOrderConfirmed(o.id);
    await recordPurchaseEvent(updated);
  }
  return updated;
}

export async function findUserOrder(userId: string, idOrNumber: string) {
  const byNumber = !/^[0-9a-f-]{36}$/i.test(idOrNumber);
  const o = await db.query.orders.findFirst({
    where: and(byNumber ? eq(orders.orderNumber, idOrNumber) : eq(orders.id, idOrNumber), eq(orders.userId, userId)),
    with: { items: true, history: { orderBy: (h, { asc }) => asc(h.createdAt) }, returns: true },
  });
  if (!o) throw notFound('Order');
  return o;
}

// Small helpers to keep SQL increments readable
const sql_inc = (col: AnyColumn) => sql`${col} + 1`;
const sql_dec = (col: AnyColumn, n: number) => sql`greatest(${col} - ${n}, 0)`;
