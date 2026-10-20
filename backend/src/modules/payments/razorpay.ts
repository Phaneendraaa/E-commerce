import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

let client: Razorpay | null = null;

export function razorpay(): Razorpay | null {
  if (!env.razorpayEnabled) return null;
  client ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return client;
}

/**
 * Create a Razorpay order. Without credentials (development) a mock order id is
 * returned so the checkout flow can be exercised end-to-end.
 */
export async function createGatewayOrder(amount: number, receipt: string, notes: Record<string, string> = {}) {
  const rz = razorpay();
  if (!rz) return { id: `order_mock_${crypto.randomBytes(8).toString('hex')}`, mock: true as const };
  const o = await rz.orders.create({ amount, currency: 'INR', receipt: receipt.slice(0, 40), notes });
  return { id: o.id, mock: false as const };
}

/** Verifies the signature returned by Razorpay Checkout after a successful payment. */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function fetchPayment(paymentId: string) {
  const rz = razorpay();
  if (!rz) return null;
  try {
    return await rz.payments.fetch(paymentId);
  } catch (e) {
    logger.warn(`Could not fetch Razorpay payment ${paymentId}`, e);
    return null;
  }
}

/** Initiates a refund. Returns true when the gateway accepted it. */
export async function refundPayment(paymentId: string, amount: number, notes: Record<string, string> = {}) {
  const rz = razorpay();
  if (!rz || paymentId.startsWith('pay_mock') || paymentId.startsWith('pay_seed')) {
    logger.info(`[razorpay:mock] refund ₹${amount / 100} for ${paymentId}`);
    return true;
  }
  try {
    await rz.payments.refund(paymentId, { amount, speed: 'normal', notes });
    return true;
  } catch (e) {
    logger.error(`Razorpay refund failed for ${paymentId}`, e);
    return false;
  }
}
