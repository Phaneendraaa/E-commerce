import axios from 'axios';
import { env } from '../../../config/env';
import { logger } from '../../../lib/logger';
import type { SendResult } from './email';

/**
 * WhatsApp Cloud API (Meta).
 *
 * Business-initiated messages must use pre-approved templates. Each of our
 * template keys maps to a Meta template name + ordered body parameters
 * (see notifications/templates.ts and docs/WHATSAPP_TEMPLATES.md).
 * Inside the 24h customer-service window, free-form text is allowed — sendText().
 */
export interface WaTemplate {
  name: string;
  params: string[];
  /** Optional dynamic URL suffix for a "Visit website" button (button index 0). */
  buttonUrlParam?: string;
}

const base = () => `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const configured = () => env.WHATSAPP_PROVIDER === 'meta' && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN;
const waNumber = (to: string) => to.replace(/\D/g, '');

export async function sendWhatsAppTemplate(to: string, tpl: WaTemplate, previewText: string): Promise<SendResult> {
  if (!configured()) {
    logger.info(`[whatsapp:console] → ${to} | template=${tpl.name} | ${previewText}`);
    return { ok: true, skipped: true };
  }
  const components: any[] = [];
  if (tpl.params.length) {
    components.push({ type: 'body', parameters: tpl.params.map((text) => ({ type: 'text', text: String(text).slice(0, 1000) })) });
  }
  if (tpl.buttonUrlParam) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: tpl.buttonUrlParam }] });
  }
  try {
    const res = await axios.post(
      base(),
      {
        messaging_product: 'whatsapp',
        to: waNumber(to),
        type: 'template',
        template: { name: tpl.name, language: { code: env.WHATSAPP_TEMPLATE_LANG }, components },
      },
      { headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }, timeout: 10_000 },
    );
    return { ok: true, id: res.data?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.response?.data?.error?.message ?? e.message };
  }
}

export async function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  if (!configured()) {
    logger.info(`[whatsapp:console] → ${to} | ${body}`);
    return { ok: true, skipped: true };
  }
  try {
    const res = await axios.post(
      base(),
      { messaging_product: 'whatsapp', to: waNumber(to), type: 'text', text: { body, preview_url: true } },
      { headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }, timeout: 10_000 },
    );
    return { ok: true, id: res.data?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.response?.data?.error?.message ?? e.message };
  }
}
