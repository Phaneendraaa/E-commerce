import axios from 'axios';
import { env } from '../../../config/env';
import { logger } from '../../../lib/logger';
import type { SendResult } from './email';

/**
 * SMS providers:
 *  - twilio : global, simple REST API
 *  - msg91  : India, DLT-compliant (requires approved DLT template IDs)
 *  - console: logs only (development)
 */
export async function sendSms(to: string, text: string, opts: { otp?: string } = {}): Promise<SendResult> {
  try {
    switch (env.SMS_PROVIDER) {
      case 'twilio':
        return await viaTwilio(to, text);
      case 'msg91':
        return await viaMsg91(to, text, opts.otp);
      default:
        logger.info(`[sms:console] → ${to} | ${text}`);
        return { ok: true, skipped: true };
    }
  } catch (e: any) {
    return { ok: false, error: e?.response?.data ? JSON.stringify(e.response.data) : e.message };
  }
}

async function viaTwilio(to: string, body: string): Promise<SendResult> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    return { ok: false, error: 'Twilio is not configured' };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const res = await axios.post(url, new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER, Body: body }), {
    auth: { username: env.TWILIO_ACCOUNT_SID, password: env.TWILIO_AUTH_TOKEN },
    timeout: 10_000,
  });
  return { ok: true, id: res.data.sid };
}

async function viaMsg91(to: string, text: string, otp?: string): Promise<SendResult> {
  if (!env.MSG91_AUTH_KEY) return { ok: false, error: 'MSG91 is not configured' };
  const mobile = to.replace('+', '');
  if (otp && env.MSG91_OTP_TEMPLATE_ID) {
    const res = await axios.post(
      'https://control.msg91.com/api/v5/otp',
      {},
      {
        params: { template_id: env.MSG91_OTP_TEMPLATE_ID, mobile, otp },
        headers: { authkey: env.MSG91_AUTH_KEY },
        timeout: 10_000,
      },
    );
    return { ok: res.data?.type === 'success', id: res.data?.request_id, error: res.data?.message };
  }
  // Transactional SMS via Flow API (DLT template must contain a ##message## variable)
  const res = await axios.post(
    'https://control.msg91.com/api/v5/flow',
    { template_id: env.MSG91_DLT_TEMPLATE_ID, short_url: '0', recipients: [{ mobiles: mobile, message: text }] },
    { headers: { authkey: env.MSG91_AUTH_KEY }, timeout: 10_000 },
  );
  return { ok: res.data?.type === 'success', id: res.data?.message, error: res.data?.type !== 'success' ? res.data?.message : undefined };
}
