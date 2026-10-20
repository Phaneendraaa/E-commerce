import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah, pageMeta, paging } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { badRequest, notFound } from '../../utils/errors';
import { normalizePhone } from '../../utils/format';
import { getSettings } from '../settings/settings.service';
import { background } from '../../lib/background';
import * as catalog from './catalog.service';

const { products, reviews, reviewVotes, questions, wishlistItems, recentlyViewed, brands, orders, orderItems, stockAlerts, productVariants } = schema;

export const catalogRouter = Router();

// ───────────── Categories & brands ─────────────

catalogRouter.get(
  '/categories',
  ah(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ categories: await catalog.categoryTree() });
  }),
);

catalogRouter.get(
  '/brands',
  ah(async (_req, res) => {
    const list = await db
      .select({ id: brands.id, name: brands.name, slug: brands.slug, logo: brands.logo, productCount: sql<number>`count(${products.id})::int` })
      .from(brands)
      .leftJoin(products, and(eq(products.brandId, brands.id), eq(products.isActive, true)))
      .where(eq(brands.isActive, true))
      .groupBy(brands.id)
      .orderBy(brands.name);
    res.json({ brands: list });
  }),
);

// ───────────── Products ─────────────

const boolQ = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === 'true' || v === '1');

const listQuery = z.object({
  q: z.string().max(100).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  inStock: boolQ,
  onSale: boolQ,
  featured: boolQ,
  newArrival: boolQ,
  deals: boolQ,
  tag: z.string().optional(),
  options: z.string().optional(),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'popular', 'rating', 'discount']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

catalogRouter.get(
  '/products',
  validate({ query: listQuery }),
  ah(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const r = await catalog.listProducts(q);
    res.json({
      items: r.items,
      facets: r.facets,
      category: r.category ? { id: r.category.id, name: r.category.name, slug: r.category.slug, description: r.category.description, image: r.category.image, breadcrumb: await catalog.breadcrumb(r.category.id) } : null,
      ...pageMeta({ page: q.page, limit: q.limit, skip: 0 }, r.total),
    });
  }),
);

catalogRouter.get(
  '/products/suggest',
  validate({ query: z.object({ q: z.string().trim().min(1).max(80) }) }),
  ah(async (req, res) => {
    res.json(await catalog.suggest(String(req.query.q)));
  }),
);

catalogRouter.get(
  '/products/recently-viewed',
  requireAuth,
  ah(async (req, res) => {
    const rows = await db.query.recentlyViewed.findMany({
      where: eq(recentlyViewed.userId, req.user!.id),
      orderBy: desc(recentlyViewed.viewedAt),
      limit: 12,
      columns: { productId: true },
    });
    res.json({ items: await catalog.cardsByIds(rows.map((r) => r.productId)) });
  }),
);

/** Batch lookup of product cards — used for guest recently-viewed & comparisons. */
catalogRouter.get(
  '/products/by-ids',
  validate({ query: z.object({ ids: z.string().max(2000) }) }),
  ah(async (req, res) => {
    const ids = String(req.query.ids)
      .split(',')
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
      .slice(0, 24);
    res.json({ items: await catalog.cardsByIds(ids) });
  }),
);

catalogRouter.get(
  '/products/:slug',
  optionalAuth,
  ah(async (req, res) => {
    const p = await catalog.productBySlug(req.params.slug);
    if (!p) throw notFound('Product');

    // Fire-and-forget view bookkeeping
    background(db.update(products).set({ viewCount: sql`${products.viewCount} + 1` }).where(eq(products.id, p.id)).then(() => undefined));
    if (req.user) {
      background(
        db
        .insert(recentlyViewed)
        .values({ userId: req.user.id, productId: p.id })
        .onConflictDoUpdate({ target: [recentlyViewed.userId, recentlyViewed.productId], set: { viewedAt: new Date() } })
          .then(() => undefined),
      );
    }

    let inWishlist = false;
    if (req.user) {
      inWishlist = Boolean(await db.query.wishlistItems.findFirst({ where: and(eq(wishlistItems.userId, req.user.id), eq(wishlistItems.productId, p.id)), columns: { id: true } }));
    }
    res.json({ product: { ...p, inWishlist } });
  }),
);

catalogRouter.get(
  '/products/:slug/related',
  ah(async (req, res) => {
    const p = await db.query.products.findFirst({ where: eq(products.slug, req.params.slug), columns: { id: true, categoryId: true } });
    if (!p) throw notFound('Product');
    const [related, together] = await Promise.all([catalog.relatedProducts(p.id, p.categoryId), catalog.frequentlyBoughtTogether(p.id)]);
    res.json({ related, frequentlyBoughtTogether: together });
  }),
);

// ───────────── Reviews ─────────────

catalogRouter.get(
  '/products/:id/reviews',
  optionalAuth,
  validate({
    query: z.object({
      sort: z.enum(['recent', 'helpful', 'rating_high', 'rating_low']).default('helpful'),
      rating: z.coerce.number().int().min(1).max(5).optional(),
      withImages: boolQ,
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
  }),
  ah(async (req, res) => {
    const q = req.query as any;
    const p = paging(q, 10, 50);
    const conds = [eq(reviews.productId, req.params.id), eq(reviews.status, 'APPROVED')];
    if (q.rating) conds.push(eq(reviews.rating, q.rating));
    if (q.withImages) conds.push(sql`cardinality(${reviews.images}) > 0`);
    const where = and(...conds);
    const orderBy =
      q.sort === 'recent' ? [desc(reviews.createdAt)] : q.sort === 'rating_high' ? [desc(reviews.rating), desc(reviews.createdAt)] : q.sort === 'rating_low' ? [reviews.rating, desc(reviews.createdAt)] : [desc(reviews.helpfulCount), desc(reviews.createdAt)];

    const [items, total] = await Promise.all([
      db.query.reviews.findMany({ where, orderBy, limit: p.limit, offset: p.skip, with: { user: { columns: { name: true, avatar: true } } } }),
      db.$count(reviews, where),
    ]);

    let myVotes = new Set<string>();
    if (req.user && items.length) {
      const votes = await db.query.reviewVotes.findMany({ where: and(eq(reviewVotes.userId, req.user.id), inArray(reviewVotes.reviewId, items.map((i) => i.id))), columns: { reviewId: true } });
      myVotes = new Set(votes.map((v) => v.reviewId));
    }
    res.json({
      items: items.map((r) => ({ ...r, user: { name: r.user.name.split(' ')[0] + (r.user.name.includes(' ') ? ` ${r.user.name.split(' ').pop()![0]}.` : ''), avatar: r.user.avatar }, votedHelpful: myVotes.has(r.id) })),
      ...pageMeta(p, total),
    });
  }),
);

catalogRouter.get(
  '/products/:id/reviews/eligibility',
  requireAuth,
  ah(async (req, res) => {
    const [existing, purchased] = await Promise.all([
      db.query.reviews.findFirst({ where: and(eq(reviews.productId, req.params.id), eq(reviews.userId, req.user!.id)) }),
      hasPurchased(req.user!.id, req.params.id),
    ]);
    res.json({ canReview: !existing, hasReviewed: Boolean(existing), verifiedPurchase: purchased, review: existing ?? null });
  }),
);

async function hasPurchased(userId: string, productId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.userId, userId), eq(orderItems.productId, productId), eq(orders.status, 'DELIVERED')));
  return row.n > 0;
}

catalogRouter.post(
  '/products/:id/reviews',
  requireAuth,
  validate({
    body: z.object({
      rating: z.number().int().min(1).max(5),
      title: z.string().trim().max(120).optional(),
      body: z.string().trim().max(3000).optional(),
      images: z.array(z.string().max(500)).max(6).default([]),
    }),
  }),
  ah(async (req, res) => {
    const productId = req.params.id;
    const product = await db.query.products.findFirst({ where: eq(products.id, productId), columns: { id: true } });
    if (!product) throw notFound('Product');
    const [settings, verified] = await Promise.all([getSettings(), hasPurchased(req.user!.id, productId)]);
    const status = settings.reviewAutoApprove ? 'APPROVED' : 'PENDING';

    const [review] = await db
      .insert(reviews)
      .values({ ...req.body, productId, userId: req.user!.id, isVerifiedPurchase: verified, status })
      .onConflictDoUpdate({
        target: [reviews.productId, reviews.userId],
        set: { ...req.body, status, updatedAt: new Date() },
      })
      .returning();
    await catalog.recalcRating(productId);
    res.status(201).json({ review, message: status === 'APPROVED' ? 'Thanks for your review!' : 'Thanks! Your review will appear after moderation.' });
  }),
);

catalogRouter.post(
  '/reviews/:id/helpful',
  requireAuth,
  ah(async (req, res) => {
    const reviewId = req.params.id;
    const existing = await db.query.reviewVotes.findFirst({ where: and(eq(reviewVotes.reviewId, reviewId), eq(reviewVotes.userId, req.user!.id)) });
    await db.transaction(async (tx) => {
      if (existing) {
        await tx.delete(reviewVotes).where(eq(reviewVotes.id, existing.id));
        await tx.update(reviews).set({ helpfulCount: sql`greatest(${reviews.helpfulCount} - 1, 0)` }).where(eq(reviews.id, reviewId));
      } else {
        await tx.insert(reviewVotes).values({ reviewId, userId: req.user!.id });
        await tx.update(reviews).set({ helpfulCount: sql`${reviews.helpfulCount} + 1` }).where(eq(reviews.id, reviewId));
      }
    });
    res.json({ voted: !existing });
  }),
);

// ───────────── Questions & answers ─────────────

catalogRouter.get(
  '/products/:id/questions',
  ah(async (req, res) => {
    const items = await db.query.questions.findMany({
      where: and(eq(questions.productId, req.params.id), eq(questions.isPublished, true)),
      orderBy: [desc(sql`${questions.answer} is not null`), desc(questions.createdAt)],
      limit: 30,
      with: { user: { columns: { name: true } } },
    });
    res.json({ items: items.map((q) => ({ ...q, user: { name: q.user.name.split(' ')[0] } })) });
  }),
);

catalogRouter.post(
  '/products/:id/questions',
  requireAuth,
  validate({ body: z.object({ question: z.string().trim().min(5).max(500) }) }),
  ah(async (req, res) => {
    const [q] = await db.insert(questions).values({ productId: req.params.id, userId: req.user!.id, question: req.body.question }).returning();
    res.status(201).json({ question: q });
  }),
);

// ───────────── Wishlist ─────────────

catalogRouter.get(
  '/wishlist',
  requireAuth,
  ah(async (req, res) => {
    const rows = await db.query.wishlistItems.findMany({ where: eq(wishlistItems.userId, req.user!.id), orderBy: desc(wishlistItems.createdAt), columns: { productId: true } });
    res.json({ items: await catalog.cardsByIds(rows.map((r) => r.productId)), ids: rows.map((r) => r.productId) });
  }),
);

catalogRouter.post(
  '/wishlist/:productId',
  requireAuth,
  ah(async (req, res) => {
    await db.insert(wishlistItems).values({ userId: req.user!.id, productId: req.params.productId }).onConflictDoNothing();
    res.status(201).json({ ok: true });
  }),
);

catalogRouter.delete(
  '/wishlist/:productId',
  requireAuth,
  ah(async (req, res) => {
    await db.delete(wishlistItems).where(and(eq(wishlistItems.userId, req.user!.id), eq(wishlistItems.productId, req.params.productId)));
    res.json({ ok: true });
  }),
);

// ───────────── Back-in-stock alerts ─────────────

catalogRouter.post(
  '/variants/:variantId/notify-me',
  optionalAuth,
  validate({ body: z.object({ email: z.string().email().optional(), phone: z.string().optional() }) }),
  ah(async (req, res) => {
    const variant = await db.query.productVariants.findFirst({ where: eq(productVariants.id, req.params.variantId), columns: { id: true, stock: true } });
    if (!variant) throw notFound('Variant');
    if (variant.stock > 0) throw badRequest('This item is already in stock');
    const phone = req.body.phone ? normalizePhone(req.body.phone) : null;
    if (!req.user && !req.body.email && !phone) throw badRequest('Provide an email or phone number');
    await db.insert(stockAlerts).values({ variantId: variant.id, userId: req.user?.id, email: req.body.email, phone });
    res.status(201).json({ ok: true, message: "We'll notify you as soon as it's back." });
  }),
);
