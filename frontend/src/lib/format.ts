import type { OrderStatus } from './types';

/** 129900 → "₹1,299" ; 129950 → "₹1,299.50" */
export function inr(paise: number | null | undefined, opts: { compact?: boolean } = {}) {
  const v = (paise ?? 0) / 100;
  if (opts.compact) {
    if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, '')}Cr`;
    if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2).replace(/\.?0+$/, '')}L`;
    if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-IN');

export function date(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
}

export function dateTime(d: string | Date | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(d: string | Date) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return date(d);
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
  FAILED: 'Payment failed',
};

export const STATUS_TONE: Record<OrderStatus, 'neutral' | 'info' | 'success' | 'warn' | 'danger'> = {
  PENDING_PAYMENT: 'warn',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  PACKED: 'info',
  SHIPPED: 'info',
  OUT_FOR_DELIVERY: 'warn',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  RETURN_REQUESTED: 'warn',
  RETURNED: 'neutral',
  REFUNDED: 'neutral',
  FAILED: 'danger',
};

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export function offerLabel(o: { type: string; value: number; maxDiscount: number | null }) {
  if (o.type === 'PERCENT') return `${o.value}% off${o.maxDiscount ? ` up to ${inr(o.maxDiscount)}` : ''}`;
  if (o.type === 'FLAT') return `${inr(o.value)} off`;
  return 'Free shipping';
}
