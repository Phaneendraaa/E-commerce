'use client';

import { api } from './api';
import type { PaymentIntent } from './types';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export type PayResult = { status: 'paid'; orderNumber: string } | { status: 'dismissed' } | { status: 'failed'; message: string };

/**
 * Opens Razorpay Checkout and verifies the payment server-side.
 * In development without Razorpay keys (mock intent) it simulates a successful UPI payment.
 */
export async function pay(intent: PaymentIntent, opts: { confirmMock?: () => Promise<boolean> } = {}): Promise<PayResult> {
  if (intent.mock) {
    const ok = opts.confirmMock ? await opts.confirmMock() : window.confirm('Razorpay is not configured. Simulate a successful payment?');
    if (!ok) return { status: 'dismissed' };
    const r = await api<{ order: { orderNumber: string } }>('/payments/mock/confirm', { body: { razorpayOrderId: intent.razorpayOrderId } });
    return { status: 'paid', orderNumber: r.order.orderNumber };
  }

  if (!(await loadScript())) return { status: 'failed', message: 'Could not load the payment window. Check your connection and try again.' };

  return new Promise<PayResult>((resolve) => {
    const rz = new window.Razorpay({
      key: intent.keyId,
      amount: intent.amount,
      currency: intent.currency,
      name: intent.name,
      description: intent.description,
      order_id: intent.razorpayOrderId,
      prefill: intent.prefill,
      theme: { color: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1b1446' },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const r = await api<{ order: { orderNumber: string } }>('/payments/razorpay/verify', { body: resp });
          resolve({ status: 'paid', orderNumber: r.order.orderNumber });
        } catch (e) {
          resolve({ status: 'failed', message: (e as Error).message });
        }
      },
      modal: { ondismiss: () => resolve({ status: 'dismissed' }), confirm_close: true },
    });
    rz.on('payment.failed', (resp: any) => resolve({ status: 'failed', message: resp?.error?.description ?? 'Payment failed' }));
    rz.open();
  });
}
