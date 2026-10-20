import { Router } from 'express';
import { and, asc, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { notFound } from '../../utils/errors';
import { getSettings, publicSettings } from '../settings/settings.service';
import * as catalog from '../catalog/catalog.service';

const { banners, pages, coupons, newsletterSubscribers, products, categories } = schema;

export const cmsRouter = Router();

const activeWindow = (startsAt: any, endsAt: any) => and(or(isNull(startsAt), lte(startsAt, sql`now()`)), or(isNull(endsAt), gt(endsAt, sql`now()`)));

cmsRouter.get(
  '/settings',
  ah(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ settings: publicSettings(await getSettings()) });
  }),
);

cmsRouter.get(
  '/banners',
  ah(async (_req, res) => {
    const list = await db.query.banners.findMany({
      where: and(eq(banners.isActive, true), activeWindow(banners.startsAt, banners.endsAt)),
      orderBy: [asc(banners.sortOrder), desc(banners.createdAt)],
    });
    res.json({ banners: list });
  }),
);

/** Everything the home page needs in one round-trip. */
cmsRouter.get(
  '/home',
  ah(async (_req, res) => {
    const active = eq(products.isActive, true);
    const [bannerList, featuredCats, featured, newArrivals, bestSellers, deals, topRated, offers] = await Promise.all([
      db.query.banners.findMany({ where: and(eq(banners.isActive, true), activeWindow(banners.startsAt, banners.endsAt)), orderBy: asc(banners.sortOrder) }),
      db.query.categories.findMany({ where: and(eq(categories.isActive, true), isNull(categories.parentId)), orderBy: [desc(categories.isFeatured), asc(categories.sortOrder)], limit: 12 }),
      catalog.fetchCards(and(active, eq(products.isFeatured, true)), [desc(products.soldCount)], 8),
      catalog.fetchCards(and(active, eq(products.isNewArrival, true)), [desc(products.createdAt)], 8),
      catalog.fetchCards(active, [desc(products.soldCount)], 8),
      catalog.fetchCards(and(active, sql`${products.dealEndsAt} > now()`), [asc(products.dealEndsAt)], 8),
      catalog.fetchCards(and(active, sql`${products.ratingCount} >= 1`), [desc(products.ratingAvg), desc(products.ratingCount)], 8),
      db.query.coupons.findMany({
        where: and(eq(coupons.isActive, true), eq(coupons.isPublic, true), activeWindow(coupons.startsAt, coupons.endsAt)),
        columns: { code: true, description: true, type: true, value: true, maxDiscount: true, minOrderValue: true, endsAt: true },
        limit: 6,
      }),
    ]);
    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      banners: bannerList,
      categories: featuredCats,
      sections: { featured, newArrivals, bestSellers, deals, topRated },
      offers,
    });
  }),
);

cmsRouter.get(
  '/offers',
  ah(async (_req, res) => {
    const list = await db.query.coupons.findMany({
      where: and(eq(coupons.isActive, true), eq(coupons.isPublic, true), activeWindow(coupons.startsAt, coupons.endsAt)),
      columns: { code: true, description: true, type: true, value: true, maxDiscount: true, minOrderValue: true, endsAt: true, firstOrderOnly: true },
      orderBy: desc(coupons.createdAt),
    });
    res.json({ offers: list });
  }),
);

cmsRouter.get(
  '/pages/:slug',
  ah(async (req, res) => {
    const page = await db.query.pages.findFirst({ where: and(eq(pages.slug, req.params.slug), eq(pages.isPublished, true)) });
    if (!page) throw notFound('Page');
    res.json({ page });
  }),
);

cmsRouter.post(
  '/newsletter',
  validate({ body: z.object({ email: z.string().trim().email() }) }),
  ah(async (req, res) => {
    await db.insert(newsletterSubscribers).values({ email: req.body.email.toLowerCase() }).onConflictDoNothing();
    res.status(201).json({ ok: true, message: "You're subscribed! Watch your inbox for exclusive deals." });
  }),
);

/** Simple pincode serviceability + ETA estimate (replace with your courier's API). */
cmsRouter.get(
  '/delivery-estimate',
  validate({ query: z.object({ pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode') }) }),
  ah(async (req, res) => {
    const pin = String(req.query.pincode);
    const s = await getSettings();
    // Metro pincodes (first 2 digits) ship faster — tweak for your warehouse location.
    const metro = ['11', '40', '50', '56', '60', '70', '41', '38', '12', '20'].includes(pin.slice(0, 2));
    const days = metro ? 2 : pin.startsWith('7') || pin.startsWith('19') ? 6 : 4;
    const eta = new Date(Date.now() + days * 86_400_000);
    res.json({ serviceable: true, codAvailable: s.codEnabled, days, eta, freeShippingThreshold: s.freeShippingThreshold });
  }),
);
