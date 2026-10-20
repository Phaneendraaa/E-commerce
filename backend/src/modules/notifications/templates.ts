import { env } from '../../config/env';
import { formatDate, formatINR } from '../../utils/format';
import type { StoreSettings } from '../settings/settings.service';
import type { WaTemplate } from './providers/whatsapp';

export type TemplateKey =
  | 'OTP'
  | 'WELCOME'
  | 'PASSWORD_RESET'
  | 'ORDER_CONFIRMED'
  | 'PAYMENT_PENDING'
  | 'ORDER_SHIPPED'
  | 'TRACKING_REMINDER'
  | 'OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'REVIEW_REQUEST'
  | 'ORDER_CANCELLED'
  | 'ABANDONED_CART'
  | 'BACK_IN_STOCK'
  | 'RETURN_UPDATE'
  | 'REFUND_PROCESSED'
  | 'CUSTOM';

export interface Rendered {
  email?: { subject: string; html: string; text: string };
  sms?: string;
  whatsapp?: { template: WaTemplate; preview: string };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = Record<string, any>;

const url = (path: string) => `${env.FRONTEND_URL.replace(/\/$/, '')}${path}`;

// ───────────── Email layout ─────────────

function layout(s: StoreSettings, title: string, body: string, cta?: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2330">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(20,20,40,.06)">
<tr><td style="background:#111827;padding:22px 32px"><a href="${url('/')}" style="color:#fff;text-decoration:none;font-size:20px;font-weight:700;letter-spacing:.3px">${s.storeName}</a></td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${title}</h1>
<div style="font-size:15px;line-height:1.65;color:#3d4252">${body}</div>
${cta ? `<div style="margin:28px 0 8px"><a href="${cta.href}" style="display:inline-block;background:#111827;color:#fff;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:600">${cta.label}</a></div>` : ''}
</td></tr>
<tr><td style="padding:20px 32px;background:#fafafb;font-size:12px;color:#8a8fa0;line-height:1.6">
Need help? Reply to this email or write to ${s.supportEmail}.<br/>${s.storeName} · ${s.address}
</td></tr></table></td></tr></table></body></html>`;
}

function itemsTable(items: Data[] = []) {
  if (!items.length) return '';
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${i.name}${i.variantTitle && i.variantTitle !== 'Default' ? ` <span style="color:#8a8fa0">(${i.variantTitle})</span>` : ''} × ${i.quantity}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eee;white-space:nowrap">${formatINR(i.total)}</td></tr>`,
    )
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px">${rows}</table>`;
}

const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function email(s: StoreSettings, subject: string, title: string, body: string, cta?: { label: string; href: string }) {
  const html = layout(s, title, body, cta);
  return { subject, html, text: `${strip(body)}${cta ? `\n\n${cta.label}: ${cta.href}` : ''}` };
}

// ───────────── Templates ─────────────

export function render(key: TemplateKey, d: Data, s: StoreSettings): Rendered {
  const name = d.name ? String(d.name).split(' ')[0] : 'there';
  switch (key) {
    case 'OTP': {
      const text = `${d.code} is your ${s.storeName} verification code. Valid for 10 minutes. Do not share it with anyone.`;
      return {
        sms: text,
        email: email(s, `${d.code} is your verification code`, 'Your verification code', `<p>Use the code below to continue. It expires in 10 minutes.</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0">${d.code}</p><p>If you didn't request this, you can safely ignore this email.</p>`),
        whatsapp: { template: { name: 'otp_code', params: [d.code], buttonUrlParam: d.code }, preview: text },
      };
    }
    case 'WELCOME':
      return {
        email: email(s, `Welcome to ${s.storeName}! 🎉`, `Welcome, ${name}!`, `<p>Thanks for joining ${s.storeName}. Here's <b>10% off</b> your first order with code <b>WELCOME10</b>.</p><p>Your referral code is <b>${d.referralCode}</b> — share it and you both earn bonus points.</p>`, { label: 'Start shopping', href: url('/shop') }),
        whatsapp: { template: { name: 'welcome_message', params: [name, s.storeName] }, preview: `Welcome to ${s.storeName}, ${name}!` },
      };
    case 'PASSWORD_RESET':
      return {
        email: email(s, 'Reset your password', 'Reset your password', `<p>Use this code to reset your password: <b style="font-size:22px;letter-spacing:4px">${d.code}</b></p><p>It expires in 10 minutes. If you didn't request a reset, ignore this email — your password won't change.</p>`, { label: 'Reset password', href: url(`/reset-password?email=${encodeURIComponent(d.email ?? '')}`) }),
        sms: `${d.code} is your ${s.storeName} password reset code. Valid for 10 minutes.`,
      };
    case 'ORDER_CONFIRMED': {
      const preview = `Hi ${name}, your order ${d.orderNumber} for ${formatINR(d.total)} is confirmed! We'll notify you when it ships.`;
      return {
        email: email(
          s,
          `Order confirmed — ${d.orderNumber}`,
          `Thanks for your order, ${name}!`,
          `<p>Your order <b>${d.orderNumber}</b> is confirmed and being prepared.</p>${itemsTable(d.items)}<p style="font-size:16px"><b>Total: ${formatINR(d.total)}</b> · ${d.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online'}</p><p style="color:#8a8fa0">Shipping to: ${d.address ?? ''}</p>`,
          { label: 'View order', href: url(`/account/orders/${d.orderNumber}`) },
        ),
        sms: `${preview} - ${s.storeName}`,
        whatsapp: { template: { name: 'order_confirmed', params: [name, d.orderNumber, formatINR(d.total)], buttonUrlParam: `account/orders/${d.orderNumber}` }, preview },
      };
    }
    case 'PAYMENT_PENDING': {
      const preview = `Hi ${name}, your order ${d.orderNumber} is waiting for payment. Complete it before items sell out.`;
      return {
        email: email(s, `Complete your payment for ${d.orderNumber}`, 'Your order is almost done', `<p>We're holding your order <b>${d.orderNumber}</b> (${formatINR(d.total)}), but payment didn't go through.</p>`, { label: 'Complete payment', href: url(`/account/orders/${d.orderNumber}`) }),
        whatsapp: { template: { name: 'payment_pending', params: [name, d.orderNumber, formatINR(d.total)], buttonUrlParam: `account/orders/${d.orderNumber}` }, preview },
      };
    }
    case 'ORDER_SHIPPED': {
      const track = d.trackingUrl || url(`/account/orders/${d.orderNumber}`);
      const preview = `Good news ${name}! Order ${d.orderNumber} has shipped via ${d.carrier}. Tracking ID: ${d.trackingNumber}. Track: ${track}`;
      return {
        email: email(
          s,
          `Your order ${d.orderNumber} has shipped 🚚`,
          'Your order is on its way!',
          `<p>Order <b>${d.orderNumber}</b> was handed to <b>${d.carrier}</b>.</p><p>Tracking number: <b>${d.trackingNumber}</b>${d.expectedDeliveryAt ? `<br/>Expected delivery: <b>${formatDate(d.expectedDeliveryAt)}</b>` : ''}</p>`,
          { label: 'Track shipment', href: track },
        ),
        sms: `${preview} - ${s.storeName}`,
        whatsapp: { template: { name: 'order_shipped', params: [name, d.orderNumber, d.carrier, d.trackingNumber, track] }, preview },
      };
    }
    case 'TRACKING_REMINDER': {
      const track = d.trackingUrl || url(`/account/orders/${d.orderNumber}`);
      const preview = `Hi ${name}, your order ${d.orderNumber} is in transit with ${d.carrier} (ID ${d.trackingNumber}). Track it here: ${track}`;
      return {
        whatsapp: { template: { name: 'tracking_reminder', params: [name, d.orderNumber, d.carrier, d.trackingNumber, track] }, preview },
        sms: `${preview} - ${s.storeName}`,
      };
    }
    case 'OUT_FOR_DELIVERY': {
      const preview = `Hi ${name}, your order ${d.orderNumber} is out for delivery today! ${d.paymentMethod === 'COD' ? `Please keep ${formatINR(d.total)} ready.` : 'Please be available to receive it.'}`;
      return {
        email: email(s, `Out for delivery — ${d.orderNumber}`, 'Arriving today! 📦', `<p>${preview}</p>`),
        sms: `${preview} - ${s.storeName}`,
        whatsapp: { template: { name: 'out_for_delivery', params: [name, d.orderNumber, d.paymentMethod === 'COD' ? `Please keep ${formatINR(d.total)} ready (COD).` : 'Please be available to receive it.'] }, preview },
      };
    }
    case 'ORDER_DELIVERED': {
      const preview = `Hi ${name}, your order ${d.orderNumber} has been delivered. We hope you love it! 💛`;
      return {
        email: email(s, `Delivered — ${d.orderNumber}`, 'Your order was delivered', `<p>${preview}</p><p>Not right? You can request a return within ${s.returnWindowDays} days from your account.</p>`, { label: 'View order', href: url(`/account/orders/${d.orderNumber}`) }),
        whatsapp: { template: { name: 'order_delivered', params: [name, d.orderNumber] }, preview },
      };
    }
    case 'REVIEW_REQUEST': {
      const preview = `Hi ${name}, how are you liking ${d.productName}? Share a quick review and earn bonus points!`;
      return {
        email: email(s, `How was your ${d.productName}?`, 'Tell us what you think ⭐', `<p>${preview}</p>`, { label: 'Write a review', href: url(`/product/${d.productSlug}#reviews`) }),
        whatsapp: { template: { name: 'review_request', params: [name, d.productName], buttonUrlParam: `product/${d.productSlug}` }, preview },
      };
    }
    case 'ORDER_CANCELLED': {
      const preview = `Hi ${name}, your order ${d.orderNumber} has been cancelled.${d.refund ? ` A refund of ${formatINR(d.refund)} will reach you in 5-7 business days.` : ''}`;
      return {
        email: email(s, `Order cancelled — ${d.orderNumber}`, 'Your order was cancelled', `<p>${preview}</p>${d.reason ? `<p style="color:#8a8fa0">Reason: ${d.reason}</p>` : ''}`),
        sms: `${preview} - ${s.storeName}`,
        whatsapp: { template: { name: 'order_cancelled', params: [name, d.orderNumber] }, preview },
      };
    }
    case 'ABANDONED_CART': {
      const preview = `Hi ${name}, you left ${d.itemCount} item(s) worth ${formatINR(d.total)} in your cart. They're selling fast — complete your order now!`;
      return {
        email: email(s, 'You left something behind 🛒', 'Your cart misses you', `<p>${preview}</p>${itemsTable(d.items)}${d.coupon ? `<p>Here's a little nudge: use <b>${d.coupon}</b> for extra savings.</p>` : ''}`, { label: 'Return to cart', href: url('/cart') }),
        whatsapp: { template: { name: 'abandoned_cart', params: [name, String(d.itemCount), formatINR(d.total)], buttonUrlParam: 'cart' }, preview },
      };
    }
    case 'BACK_IN_STOCK': {
      const preview = `Good news! ${d.productName} is back in stock. Grab it before it's gone: ${url(`/product/${d.productSlug}`)}`;
      return {
        email: email(s, `${d.productName} is back in stock`, "It's back! 🎉", `<p>${d.productName} is available again.</p>`, { label: 'Shop now', href: url(`/product/${d.productSlug}`) }),
        whatsapp: { template: { name: 'back_in_stock', params: [d.productName], buttonUrlParam: `product/${d.productSlug}` }, preview },
      };
    }
    case 'RETURN_UPDATE': {
      const preview = `Hi ${name}, your return request for order ${d.orderNumber} is now ${String(d.status).toLowerCase().replace('_', ' ')}.`;
      return {
        email: email(s, `Return update — ${d.orderNumber}`, 'Return request update', `<p>${preview}</p>${d.note ? `<p>${d.note}</p>` : ''}`),
        whatsapp: { template: { name: 'return_update', params: [name, d.orderNumber, String(d.status).toLowerCase().replace('_', ' ')] }, preview },
      };
    }
    case 'REFUND_PROCESSED': {
      const preview = `Hi ${name}, a refund of ${formatINR(d.amount)} for order ${d.orderNumber} has been processed. It may take 5-7 business days to reflect.`;
      return {
        email: email(s, `Refund processed — ${d.orderNumber}`, 'Your refund is on its way', `<p>${preview}</p>`),
        sms: `${preview} - ${s.storeName}`,
        whatsapp: { template: { name: 'refund_processed', params: [name, formatINR(d.amount), d.orderNumber] }, preview },
      };
    }
    case 'CUSTOM':
    default:
      return {
        email: d.subject ? email(s, d.subject, d.subject, `<p>${d.message}</p>`) : undefined,
        sms: d.message,
        whatsapp: d.message ? { template: { name: d.waTemplate ?? 'custom_update', params: [name, d.message] }, preview: d.message } : undefined,
      };
  }
}
