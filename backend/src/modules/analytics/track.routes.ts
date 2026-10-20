import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { optionalAuth } from '../../middleware/auth';
import { trackLimiter } from '../../middleware/rateLimit';

export const trackRouter = Router();

const event = z.object({
  type: z.enum(schema.eventTypeEnum.enumValues),
  path: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
  productId: z
    .string()
    .regex(/^[0-9a-f-]{36}$/i)
    .optional(),
  query: z.string().max(120).optional(),
  value: z.number().int().min(0).max(100_000_000).optional(),
  meta: z.record(z.unknown()).optional(),
});

function deviceFrom(ua = '') {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * First-party analytics beacon. The storefront batches events and sends them
 * here (navigator.sendBeacon). Powers funnels, traffic and product analytics.
 */
trackRouter.post(
  '/',
  trackLimiter,
  optionalAuth,
  validate({
    body: z.object({
      sessionId: z.string().min(8).max(80),
      utm: z.object({ source: z.string().max(60).optional(), medium: z.string().max(60).optional(), campaign: z.string().max(100).optional() }).optional(),
      events: z.array(event).min(1).max(25),
    }),
  }),
  ah(async (req, res) => {
    const device = deviceFrom(req.get('user-agent'));
    // PURCHASE is recorded server-side when an order is confirmed — never trust the client for revenue.
    const rows = req.body.events
      .filter((e: z.infer<typeof event>) => e.type !== 'PURCHASE')
      .map((e: z.infer<typeof event>) => ({
        ...e,
        sessionId: req.body.sessionId,
        userId: req.user?.id ?? null,
        device,
        utmSource: req.body.utm?.source,
        utmMedium: req.body.utm?.medium,
        utmCampaign: req.body.utm?.campaign,
      }));
    if (rows.length) await db.insert(schema.analyticsEvents).values(rows).catch(() => undefined);
    res.status(204).end();
  }),
);
