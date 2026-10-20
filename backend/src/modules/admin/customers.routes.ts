import { Router } from 'express';
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah, pageMeta, paging } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireRole } from '../../middleware/auth';
import { badRequest, notFound } from '../../utils/errors';
import { revokeAllSessions } from '../auth/auth.service';
import { audit, rupees, sendCsv } from './helpers';

const { users, orders, addresses, loyaltyTransactions, carts, wishlistItems, reviews, notificationLogs } = schema;
export const adminCustomersRouter = Router();

const statsCols = {
  orders: sql<number>`(select count(*)::int from orders o where o.user_id = "users"."id" and o.status not in ('CANCELLED','FAILED','PENDING_PAYMENT'))`,
  spent: sql<number>`(select coalesce(sum(o.total), 0)::bigint from orders o where o.user_id = "users"."id" and o.status not in ('CANCELLED','FAILED','PENDING_PAYMENT'))`,
  lastOrderAt: sql<Date | null>`(select max(o.created_at) from orders o where o.user_id = "users"."id")`,
};

const listQuery = z.object({
  q: z.string().optional(),
  role: z.enum(['CUSTOMER', 'SUPPORT', 'MANAGER', 'ADMIN', 'STAFF']).optional(),
  segment: z.enum(['buyers', 'no_orders', 'repeat', 'inactive_60', 'blocked']).optional(),
  sort: z.enum(['newest', 'spent', 'orders', 'name', 'last_order']).default('newest'),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(200).default(20),
});

function where(q: z.infer<typeof listQuery>) {
  const conds: SQL[] = [];
  if (q.q) conds.push(or(ilike(users.name, `%${q.q}%`), ilike(users.email, `%${q.q}%`), ilike(users.phone, `%${q.q}%`))!);
  if (q.role === 'STAFF') conds.push(sql`${users.role} <> 'CUSTOMER'`);
  else if (q.role) conds.push(eq(users.role, q.role));
  if (q.segment === 'buyers') conds.push(sql`${statsCols.orders} > 0`);
  if (q.segment === 'no_orders') conds.push(sql`${statsCols.orders} = 0`);
  if (q.segment === 'repeat') conds.push(sql`${statsCols.orders} > 1`);
  if (q.segment === 'inactive_60') conds.push(sql`${statsCols.orders} > 0 and ${statsCols.lastOrderAt} < now() - interval '60 days'`);
  if (q.segment === 'blocked') conds.push(eq(users.isBlocked, true));
  return conds.length ? and(...conds) : undefined;
}

adminCustomersRouter.get(
  '/',
  validate({ query: listQuery }),
  ah(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const p = paging(q);
    const w = where(q);
    const order = { newest: desc(users.createdAt), spent: desc(statsCols.spent), orders: desc(statsCols.orders), name: asc(users.name), last_order: sql`${statsCols.lastOrderAt} desc nulls last` }[q.sort];
    const [items, [{ total }]] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, isBlocked: users.isBlocked, loyaltyPoints: users.loyaltyPoints, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, ...statsCols })
        .from(users)
        .where(w)
        .orderBy(order, asc(users.id))
        .limit(p.limit)
        .offset(p.skip),
      db.select({ total: sql<number>`count(*)::int` }).from(users).where(w),
    ]);
    res.json({ items: items.map((i) => ({ ...i, spent: Number(i.spent) })), ...pageMeta(p, total) });
  }),
);

adminCustomersRouter.get(
  '/export',
  validate({ query: listQuery }),
  ah(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const list = await db
      .select({ name: users.name, email: users.email, phone: users.phone, joined: users.createdAt, whatsappOptIn: users.whatsappOptIn, marketingOptIn: users.marketingOptIn, loyaltyPoints: users.loyaltyPoints, ...statsCols })
      .from(users)
      .where(where(q))
      .orderBy(desc(users.createdAt));
    sendCsv(res, `customers-${new Date().toISOString().slice(0, 10)}.csv`, list.map((l) => ({ ...l, spent: rupees(Number(l.spent)) })));
  }),
);

adminCustomersRouter.get(
  '/:id',
  ah(async (req, res) => {
    const u = await db.query.users.findFirst({ where: eq(users.id, req.params.id), with: { addresses: { orderBy: desc(addresses.isDefault) } } });
    if (!u) throw notFound('Customer');
    const { passwordHash: _p, ...user } = u;
    const [orderList, stats, loyalty, cart, wishlist, reviewCount, messages] = await Promise.all([
      db.query.orders.findMany({ where: eq(orders.userId, u.id), orderBy: desc(orders.createdAt), limit: 50, columns: { id: true, orderNumber: true, status: true, total: true, paymentMethod: true, createdAt: true } }),
      db
        .select({
          orders: sql<number>`count(*) filter (where ${orders.status} not in ('CANCELLED','FAILED','PENDING_PAYMENT'))::int`,
          spent: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} not in ('CANCELLED','FAILED','PENDING_PAYMENT')), 0)::bigint`,
          cancelled: sql<number>`count(*) filter (where ${orders.status} = 'CANCELLED')::int`,
          returned: sql<number>`count(*) filter (where ${orders.status} in ('RETURNED','REFUNDED'))::int`,
          firstOrderAt: sql<Date | null>`min(${orders.createdAt})`,
          lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
        })
        .from(orders)
        .where(eq(orders.userId, u.id)),
      db.query.loyaltyTransactions.findMany({ where: eq(loyaltyTransactions.userId, u.id), orderBy: desc(loyaltyTransactions.createdAt), limit: 30 }),
      db.query.carts.findFirst({ where: eq(carts.userId, u.id), with: { items: { with: { variant: { with: { product: { columns: { name: true, slug: true } } } } } } } }),
      db.$count(wishlistItems, eq(wishlistItems.userId, u.id)),
      db.$count(reviews, eq(reviews.userId, u.id)),
      db.query.notificationLogs.findMany({ where: eq(notificationLogs.userId, u.id), orderBy: desc(notificationLogs.createdAt), limit: 30 }),
    ]);
    const s = stats[0];
    res.json({
      customer: user,
      stats: { ...s, spent: Number(s.spent), aov: s.orders ? Math.round(Number(s.spent) / s.orders) : 0 },
      orders: orderList,
      loyalty,
      cart: cart?.items.map((i) => ({ name: i.variant.product.name, variant: i.variant.title, quantity: i.quantity, price: i.variant.price })) ?? [],
      wishlistCount: wishlist,
      reviewCount,
      notifications: messages,
    });
  }),
);

adminCustomersRouter.patch(
  '/:id',
  validate({ body: z.object({ isBlocked: z.boolean().optional(), name: z.string().min(2).max(80).optional(), whatsappOptIn: z.boolean().optional(), marketingOptIn: z.boolean().optional() }) }),
  ah(async (req, res) => {
    if (req.params.id === req.user!.id && req.body.isBlocked) throw badRequest("You can't block yourself");
    const [u] = await db.update(users).set(req.body).where(eq(users.id, req.params.id)).returning({ id: users.id, isBlocked: users.isBlocked });
    if (!u) throw notFound('Customer');
    if (req.body.isBlocked) await revokeAllSessions(u.id);
    await audit(req, 'update', 'customer', u.id, req.body);
    res.json({ customer: u });
  }),
);

adminCustomersRouter.post(
  '/:id/loyalty',
  requireRole('MANAGER'),
  validate({ body: z.object({ points: z.number().int().min(-100000).max(100000).refine((n) => n !== 0), reason: z.string().trim().min(3).max(200) }) }),
  ah(async (req, res) => {
    const u = await db.query.users.findFirst({ where: eq(users.id, req.params.id), columns: { loyaltyPoints: true } });
    if (!u) throw notFound('Customer');
    if (u.loyaltyPoints + req.body.points < 0) throw badRequest('Balance cannot go below zero');
    await db.transaction(async (tx) => {
      await tx.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} + ${req.body.points}` }).where(eq(users.id, req.params.id));
      await tx.insert(loyaltyTransactions).values({ userId: req.params.id, points: req.body.points, reason: `Adjustment: ${req.body.reason}` });
    });
    await audit(req, 'loyalty_adjust', 'customer', req.params.id, req.body);
    res.json({ ok: true, balance: u.loyaltyPoints + req.body.points });
  }),
);

adminCustomersRouter.post(
  '/:id/role',
  requireRole('ADMIN'),
  validate({ body: z.object({ role: z.enum(['CUSTOMER', 'SUPPORT', 'MANAGER', 'ADMIN']) }) }),
  ah(async (req, res) => {
    if (req.params.id === req.user!.id) throw badRequest("You can't change your own role");
    const [u] = await db.update(users).set({ role: req.body.role }).where(eq(users.id, req.params.id)).returning({ id: users.id, role: users.role });
    if (!u) throw notFound('User');
    await revokeAllSessions(u.id);
    await audit(req, 'role_change', 'user', u.id, req.body);
    res.json({ user: u });
  }),
);

