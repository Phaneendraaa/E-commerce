import { eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import type { Channel } from '../../db/schema';
import { logger } from '../../lib/logger';
import { getSettings } from '../settings/settings.service';
import { sendEmail, type SendResult } from './providers/email';
import { sendSms } from './providers/sms';
import { sendWhatsAppTemplate, sendWhatsAppText } from './providers/whatsapp';
import { render, type TemplateKey } from './templates';

export interface NotifyInput {
  template: TemplateKey;
  data: Record<string, unknown>;
  channels: Channel[];
  /** Explicit recipients; otherwise looked up from userId. */
  to?: { email?: string | null; phone?: string | null };
  userId?: string | null;
  orderId?: string | null;
  /** Ignore the user's WhatsApp opt-out (e.g. OTPs). */
  force?: boolean;
}

export interface NotifyResult {
  channel: Channel;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  error?: string;
}

/**
 * Renders a template and sends it on every requested channel, logging each
 * attempt to notification_logs. Never throws — notification failures must not
 * break the business flow that triggered them.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult[]> {
  const results: NotifyResult[] = [];
  try {
    const s = await getSettings();
    let email = input.to?.email ?? null;
    let phone = input.to?.phone ?? null;
    let waOptIn = true;
    let name = (input.data.name as string | undefined) ?? undefined;

    if (input.userId && (!email || !phone || !name)) {
      const u = await db.query.users.findFirst({ where: eq(schema.users.id, input.userId) });
      if (u) {
        email ??= u.email;
        phone ??= u.phone;
        waOptIn = u.whatsappOptIn;
        name ??= u.name;
      }
    }

    const rendered = render(input.template, { ...input.data, name }, s);

    for (const channel of input.channels) {
      let to: string | null = null;
      let subject: string | undefined;
      let body: string | undefined;
      let send: (() => Promise<SendResult>) | null = null;

      if (channel === 'EMAIL' && rendered.email && email) {
        to = email;
        subject = rendered.email.subject;
        body = rendered.email.text;
        const e = rendered.email;
        send = () => sendEmail(email!, e.subject, e.html, e.text);
      } else if (channel === 'SMS' && rendered.sms && phone) {
        to = phone;
        body = rendered.sms;
        const text = rendered.sms;
        send = () => sendSms(phone!, text, { otp: input.template === 'OTP' ? String(input.data.code) : undefined });
      } else if (channel === 'WHATSAPP' && rendered.whatsapp && phone && (waOptIn || input.force)) {
        to = phone;
        body = rendered.whatsapp.preview;
        const w = rendered.whatsapp;
        send = () => sendWhatsAppTemplate(phone!, w.template, w.preview);
      }

      if (!send || !to) {
        results.push({ channel, status: 'SKIPPED', error: 'No recipient or template for channel' });
        continue;
      }

      const r = await send();
      const status = !r.ok ? 'FAILED' : r.skipped ? 'SKIPPED' : 'SENT';
      results.push({ channel, status, error: r.error });
      await db.insert(schema.notificationLogs).values({
        channel,
        to,
        template: input.template,
        subject,
        body,
        status,
        error: r.error ?? (r.skipped ? 'Provider not configured (logged to console)' : null),
        providerMessageId: r.id,
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
        sentAt: r.ok ? new Date() : null,
      });
      if (!r.ok) logger.warn(`Notification ${input.template} via ${channel} to ${to} failed: ${r.error}`);
    }
  } catch (e) {
    logger.error(`notify(${input.template}) crashed`, e);
  }
  return results;
}

/** Fire-and-forget variant for request handlers. */
export function notifyAsync(input: NotifyInput) {
  void notify(input);
}

/** Free-form WhatsApp text (only deliverable inside the 24h customer-service window). */
export async function sendManualWhatsApp(opts: { phone: string; text: string; userId?: string; orderId?: string }) {
  const r = await sendWhatsAppText(opts.phone, opts.text);
  await db.insert(schema.notificationLogs).values({
    channel: 'WHATSAPP',
    to: opts.phone,
    template: 'MANUAL',
    body: opts.text,
    status: !r.ok ? 'FAILED' : r.skipped ? 'SKIPPED' : 'SENT',
    error: r.error,
    providerMessageId: r.id,
    userId: opts.userId,
    orderId: opts.orderId,
    sentAt: r.ok ? new Date() : null,
  });
  return r;
}
