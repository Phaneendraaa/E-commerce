import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../../config/env';
import { logger } from '../../../lib/logger';

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.emailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
      pool: true,
      maxConnections: 3,
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<SendResult> {
  const t = getTransporter();
  if (!t) {
    logger.info(`[email:console] → ${to} | ${subject}`);
    return { ok: true, skipped: true };
  }
  try {
    const info = await t.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.GMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
