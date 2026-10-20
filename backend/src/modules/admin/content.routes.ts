import { Router } from 'express';
import { and, asc, desc, eq, ilike, isNull, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah, pageMeta, paging } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireRole } from '../../middleware/auth';
import { badRequest, notFound } from '../../utils/errors';
import { recalcRating } from '../catalog/catalog.service';
import { getSettings, updateSettings, type StoreSettings } from '../settings/settings.service';
import { notify } from '../notifications/notify';
import { jobs } from '../../jobs';
import { audit } from './helpers';

const { coupons, banners, pages, reviews, questions, notificationLogs, users, orders, auditLogs, newsletterSubscribers, couponRedemptions } = schema;
export const adminContentRouter = Router();
const manager = requireRole('MANAGER');
const admin = requireRole('ADMIN');

// ───────────── Coupons ─────────────

const couponInput = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, - and _ only')
      .transform((s) => s.toUpperCase()),
    description: z.string().max(300).nullable().optional(),
    type: z.enum(['PERCENT', 'FLAT', 'FREE_SHIPPING']),
    value: z.number().int().min(0),
    maxDiscount: z.number().int().min(0).nullable().optional(),
    minOrderValue: z.number().int().min(0).default(0),
    usageLimit: z.number().int().min(1).nullable().optional(),
    perUserLimit: z.number().int().min(1).default(1),
    firstOrderOnly: z.boolean().default(false),
    applicableCategoryIds: z.array(z.string().uuid()).default([]),
    isActive: z.boolean().default(true),
    isPublic: z.boolean().default(true),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
  })
  .refine((c) => c.type !== 'PERCENT' || c.value <= 100, { message: 'Percent must be 100 or less', path: ['value'] });

adminContentRouter.get(
  '/coupons',
  ah(async (_req, res) => {
    const list = await db
      .select({ coupon: coupons, revenue: sql<number>`coalesce((select sum(o.total) from coupon_redemptions cr join orders o on o.id = cr.order_id where cr.coupon_id = "coupons"."id"), 0)::bigint`, discountGiven: sql<number>`coalesce((select sum(discount) from coupon_redemptions cr where cr.coupon_id = "coupons"."id"), 0)::bigint` })
      .from(coupons)
      .orderBy(desc(coupons.createdAt));
    res.json({ coupons: list.map((l) => ({ ...l.coupon, revenue: Number(l.revenue), discountGiven: Number(l.discountGiven) })) });
  }),
);

adminContentRouter.post(
  '/coupons',
  manager,
  validate({ body: couponInput }),
  ah(async (req, res) => {
    const [c] = await db.insert(coupons).values(req.body).returning();
    await audit(req, 'create', 'coupon', c.id, { code: c.code });
    res.status(201).json({ coupon: c });
  }),
);

adminContentRouter.put(
  '/coupons/:id',
  manager,
  validate({ body: couponInput }),
  ah(async (req, res) => {
    const [c] = await db.update(coupons).set(req.body).where(eq(coupons.id, req.params.id)).returning();
    if (!c) throw notFound('Coupon');
    await audit(req, 'update', 'coupon', c.id);
    res.json({ coupon: c });
  }),
);

adminContentRouter.delete(
  '/coupons/:id',
  manager,
  ah(async (req, res) => {
    const used = await db.$count(couponRedemptions, eq(couponRedemptions.couponId, req.params.id));
    if (used) {
      await db.update(coupons).set({ isActive: false }).where(eq(coupons.id, req.params.id));
      return void res.json({ ok: true, archived: true, message: 'Coupon has been used, so it was deactivated instead of deleted.' });
    }
    await db.delete(coupons).where(eq(coupons.id, req.params.id));
    res.json({ ok: true });
  }),
);

// ───────────── Banners & pages ─────────────

const bannerInput = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().max(300).nullable().optional(),
  image: z.string().min(1).max(500),
  link: z.string().max(500).nullable().optional(),
  ctaText: z.string().max(40).nullable().optional(),
  position: z.enum(['HERO', 'PROMO_STRIP', 'MID', 'CATEGORY']).default('HERO'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

adminContentRouter.get(
  '/banners',
  ah(async (_req, res) => {
    res.json({ banners: await db.query.banners.findMany({ orderBy: [asc(banners.position), asc(banners.sortOrder)] }) });
  }),
);
adminContentRouter.post(
  '/banners',
  manager,
  validate({ body: bannerInput }),
  ah(async (req, res) => {
    const [b] = await db.insert(banners).values(req.body).returning();
    res.status(201).json({ banner: b });
  }),
);
adminContentRouter.put(
  '/banners/:id',
  manager,
  validate({ body: bannerInput }),
  ah(async (req, res) => {
    const [b] = await db.update(banners).set(req.body).where(eq(banners.id, req.params.id)).returning();
    if (!b) throw notFound('Banner');
    res.json({ banner: b });
  }),
);
adminContentRouter.delete(
  '/banners/:id',
  manager,
  ah(async (req, res) => {
    await db.delete(banners).where(eq(banners.id, req.params.id));
    res.json({ ok: true });
  }),
);

const pageInput = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only'),
  title: z.string().trim().min(2).max(120),
  content: z.string().max(100_000),
  isPublished: z.boolean().default(true),
});

adminContentRouter.get(
  '/pages',
  ah(async (_req, res) => {
    res.json({ pages: await db.query.pages.findMany({ orderBy: asc(pages.title) }) });
  }),
);
adminContentRouter.post(
  '/pages',
  manager,
  validate({ body: pageInput }),
  ah(async (req, res) => {
    const [p] = await db.insert(pages).values(req.body).returning();
    res.status(201).json({ page: p });
  }),
);
adminContentRouter.put(
  '/pages/:id',
  manager,
  validate({ body: pageInput }),
  ah(async (req, res) => {
    const [p] = await db.update(pages).set(req.body).where(eq(pages.id, req.params.id)).returning();
    if (!p) throw notFound('Page');
    res.json({ page: p });
  }),
);
adminContentRouter.delete(
  '/pages/:id',
  manager,
  ah(async (req, res) => {
    await db.delete(pages).where(eq(pages.id, req.params.id));
    res.json({ ok: true });
  }),
);

// ───────────── Reviews & questions moderation ─────────────

adminContentRouter.get(
  '/reviews',
  validate({ query: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(), rating: z.coerce.number().int().min(1).max(5).optional(), q: z.string().optional(), page: z.coerce.number().default(1), limit: z.coerce.number().max(100).default(20) }) }),
  ah(async (req, res) => {
    const q = req.query as any;
    const p = paging(q);
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(reviews.status, q.status));
    if (q.rating) conds.push(eq(reviews.rating, q.rating));
    if (q.q) conds.push(ilike(reviews.body, `%${q.q}%`));
    const where = conds.length ? and(...conds) : undefined;
    const [items, total] = await Promise.all([
      db.query.reviews.findMany({ where, orderBy: desc(reviews.createdAt), limit: p.limit, offset: p.skip, with: { user: { columns: { name: true, email: true } }, product: { columns: { name: true, slug: true, images: true } } } }),
      db.$count(reviews, where),
    ]);
    res.json({ items, ...pageMeta(p, total) });
  }),
);

adminContentRouter.patch(
  '/reviews/:id',
  validate({ body: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(), adminReply: z.string().max(1000).nullable().optional() }) }),
  ah(async (req, res) => {
    const [r] = await db.update(reviews).set(req.body).where(eq(reviews.id, req.params.id)).returning();
    if (!r) throw notFound('Review');
    await recalcRating(r.productId);
    await audit(req, 'moderate', 'review', r.id, req.body);
    res.json({ review: r });
  }),
);

adminContentRouter.delete(
  '/reviews/:id',
  manager,
  ah(async (req, res) => {
    const [r] = await db.delete(reviews).where(eq(reviews.id, req.params.id)).returning();
    if (r) await recalcRating(r.productId);
    res.json({ ok: true });
  }),
);

adminContentRouter.get(
  '/questions',
  validate({ query: z.object({ unanswered: z.coerce.boolean().optional() }) }),
  ah(async (req, res) => {
    const list = await db.query.questions.findMany({
      where: req.query.unanswered ? isNull(questions.answer) : undefined,
      orderBy: desc(questions.createdAt),
      limit: 100,
      with: { user: { columns: { name: true } }, product: { columns: { name: true, slug: true } } },
    });
    res.json({ questions: list });
  }),
);

adminContentRouter.patch(
  '/questions/:id',
  validate({ body: z.object({ answer: z.string().trim().max(2000).nullable().optional(), isPublished: z.boolean().optional() }) }),
  ah(async (req, res) => {
    const [q] = await db
      .update(questions)
      .set({ ...req.body, answeredAt: req.body.answer ? new Date() : undefined })
      .where(eq(questions.id, req.params.id))
      .returning();
    if (!q) throw notFound('Question');
    res.json({ question: q });
  }),
);

// ───────────── Notifications log & broadcasts ─────────────

adminContentRouter.get(
  '/notifications',
  validate({ query: z.object({ channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']).optional(), status: z.enum(['QUEUED', 'SENT', 'FAILED', 'SKIPPED']).optional(), template: z.string().optional(), q: z.string().optional(), page: z.coerce.number().default(1), limit: z.coerce.number().max(100).default(30) }) }),
  ah(async (req, res) => {
    const q = req.query as any;
    const p = paging(q, 30);
    const conds: SQL[] = [];
    if (q.channel) conds.push(eq(notificationLogs.channel, q.channel));
    if (q.status) conds.push(eq(notificationLogs.status, q.status));
    if (q.template) conds.push(eq(notificationLogs.template, q.template));
    if (q.q) conds.push(ilike(notificationLogs.to, `%${q.q}%`));
    const where = conds.length ? and(...conds) : undefined;
    const [items, total] = await Promise.all([
      db.query.notificationLogs.findMany({ where, orderBy: desc(notificationLogs.createdAt), limit: p.limit, offset: p.skip, with: { order: { columns: { orderNumber: true } } } }),
      db.$count(notificationLogs, where),
    ]);
    res.json({ items, ...pageMeta(p, total) });
  }),
);

/**
 * Marketing broadcast to an audience segment. Only customers who opted in to
 * marketing (email) / WhatsApp are included. WhatsApp broadcasts use the
 * approved "custom_update" template (or the one you pass).
 */
adminContentRouter.post(
  '/broadcast',
  manager,
  validate({
    body: z.object({
      audience: z.enum(['all', 'buyers', 'no_orders', 'inactive_60', 'newsletter']),
      channels: z.array(z.enum(['EMAIL', 'WHATSAPP', 'SMS'])).min(1),
      subject: z.string().trim().min(3).max(150),
      message: z.string().trim().min(5).max(1000),
      waTemplate: z.string().max(60).optional(),
      dryRun: z.boolean().default(false),
    }),
  }),
  ah(async (req, res) => {
    const b = req.body;
    const valid = sql`o.status not in ('CANCELLED','FAILED','PENDING_PAYMENT')`;
    let recipients: { id: string | null; email: string | null; phone: string | null; name: string }[] = [];
    if (b.audience === 'newsletter') {
      recipients = (await db.select().from(newsletterSubscribers)).map((n) => ({ id: null, email: n.email, phone: null, name: 'there' }));
    } else {
      const conds: SQL[] = [eq(users.role, 'CUSTOMER'), eq(users.isBlocked, false), eq(users.marketingOptIn, true)];
      if (b.audience === 'buyers') conds.push(sql`exists (select 1 from orders o where o.user_id = "users"."id" and ${valid})`);
      if (b.audience === 'no_orders') conds.push(sql`not exists (select 1 from orders o where o.user_id = "users"."id" and ${valid})`);
      if (b.audience === 'inactive_60') conds.push(sql`exists (select 1 from orders o where o.user_id = "users"."id" and ${valid}) and not exists (select 1 from orders o where o.user_id = "users"."id" and o.created_at > now() - interval '60 days')`);
      recipients = await db.select({ id: users.id, email: users.email, phone: users.phone, name: users.name }).from(users).where(and(...conds));
    }
    if (b.dryRun) return void res.json({ recipients: recipients.length, withEmail: recipients.filter((r) => r.email).length, withPhone: recipients.filter((r) => r.phone).length });
    if (recipients.length > 5000) throw badRequest('Audience too large for an in-app broadcast (max 5,000). Use a dedicated campaign tool.');

    await audit(req, 'broadcast', 'notification', null, { audience: b.audience, channels: b.channels, recipients: recipients.length });
    // Send in the background so the request returns quickly
    void (async () => {
      for (const r of recipients) {
        await notify({ template: 'CUSTOM', data: { name: r.name, subject: b.subject, message: b.message, waTemplate: b.waTemplate }, channels: b.channels, userId: r.id, to: { email: r.email, phone: r.phone } });
      }
    })();
    res.status(202).json({ queued: recipients.length });
  }),
);

// ───────────── Settings, jobs, audit ─────────────

adminContentRouter.get(
  '/settings',
  ah(async (_req, res) => {
    res.json({ settings: await getSettings() });
  }),
);

adminContentRouter.put(
  '/settings',
  admin,
  validate({ body: z.record(z.unknown()) }),
  ah(async (req, res) => {
    const s = await updateSettings(req.body as Partial<StoreSettings>);
    await audit(req, 'update', 'settings', 'store', Object.keys(req.body));
    res.json({ settings: s });
  }),
);

adminContentRouter.post(
  '/jobs/:name/run',
  admin,
  ah(async (req, res) => {
    const job = (jobs as Record<string, () => Promise<void>>)[req.params.name];
    if (!job) throw notFound('Job');
    const started = Date.now();
    await job();
    await audit(req, 'run_job', 'job', req.params.name);
    res.json({ ok: true, ms: Date.now() - started });
  }),
);

adminContentRouter.get(
  '/reminders',
  ah(async (_req, res) => {
    const list = await db.query.scheduledReminders.findMany({ orderBy: desc(schema.scheduledReminders.runAt), limit: 100, with: { order: { columns: { orderNumber: true } } } });
    const counts = await db.select({ status: schema.scheduledReminders.status, n: sql<number>`count(*)::int` }).from(schema.scheduledReminders).groupBy(schema.scheduledReminders.status);
    res.json({ reminders: list, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) });
  }),
);

adminContentRouter.get(
  '/audit',
  admin,
  validate({ query: z.object({ entity: z.string().optional(), page: z.coerce.number().default(1), limit: z.coerce.number().max(100).default(50) }) }),
  ah(async (req, res) => {
    const p = paging(req.query, 50);
    const where = req.query.entity ? eq(auditLogs.entity, String(req.query.entity)) : undefined;
    const items = await db
      .select({ log: auditLogs, user: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(p.limit)
      .offset(p.skip);
    res.json({ items: items.map((i) => ({ ...i.log, userName: i.user })), ...pageMeta(p, await db.$count(auditLogs, where)) });
  }),
);

/** Global admin search (⌘K palette): orders, customers, products. */
adminContentRouter.get(
  '/search',
  validate({ query: z.object({ q: z.string().trim().min(2).max(80) }) }),
  ah(async (req, res) => {
    const like = `%${req.query.q}%`;
    const [o, c, p] = await Promise.all([
      db
        .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, total: orders.total })
        .from(orders)
        .where(sql`${orders.orderNumber} ilike ${like} or ${orders.trackingNumber} ilike ${like}`)
        .limit(5),
      db
        .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
        .from(users)
        .where(sql`${users.name} ilike ${like} or ${users.email} ilike ${like} or ${users.phone} ilike ${like}`)
        .limit(5),
      db
        .select({ id: schema.products.id, name: schema.products.name, image: sql<string>`${schema.products.images}[1]` })
        .from(schema.products)
        .where(ilike(schema.products.name, like))
        .limit(5),
    ]);
    res.json({ orders: o, customers: c, products: p });
  }),
);

