import { Router } from 'express';
import { and, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { notFound } from '../../utils/errors';
import { toPublicUser } from '../auth/auth.service';

const { users, addresses, loyaltyTransactions } = schema;

export const usersRouter = Router();
usersRouter.use(requireAuth);

// ───────────── Profile ─────────────

usersRouter.patch(
  '/me',
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(80).optional(),
      avatar: z.string().max(500).nullable().optional(),
      whatsappOptIn: z.boolean().optional(),
      marketingOptIn: z.boolean().optional(),
    }),
  }),
  ah(async (req, res) => {
    const [u] = await db.update(users).set(req.body).where(eq(users.id, req.user!.id)).returning();
    res.json({ user: toPublicUser(u) });
  }),
);

usersRouter.get(
  '/me/loyalty',
  ah(async (req, res) => {
    const [u, history] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, req.user!.id), columns: { loyaltyPoints: true, referralCode: true } }),
      db.query.loyaltyTransactions.findMany({ where: eq(loyaltyTransactions.userId, req.user!.id), orderBy: desc(loyaltyTransactions.createdAt), limit: 50 }),
    ]);
    const referrals = await db.$count(users, eq(users.referredById, req.user!.id));
    res.json({ points: u?.loyaltyPoints ?? 0, referralCode: u?.referralCode, referrals, history });
  }),
);

// ───────────── Addresses ─────────────

const addressBody = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  landmark: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  country: z.string().trim().default('India'),
  type: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
  isDefault: z.boolean().default(false),
});

usersRouter.get(
  '/me/addresses',
  ah(async (req, res) => {
    const list = await db.query.addresses.findMany({
      where: eq(addresses.userId, req.user!.id),
      orderBy: [desc(addresses.isDefault), desc(addresses.updatedAt)],
    });
    res.json({ addresses: list });
  }),
);

usersRouter.post(
  '/me/addresses',
  validate({ body: addressBody }),
  ah(async (req, res) => {
    const userId = req.user!.id;
    const count = await db.$count(addresses, eq(addresses.userId, userId));
    const isDefault = req.body.isDefault || count === 0;
    const address = await db.transaction(async (tx) => {
      if (isDefault) await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
      const [a] = await tx.insert(addresses).values({ ...req.body, isDefault, userId }).returning();
      return a;
    });
    res.status(201).json({ address });
  }),
);

usersRouter.put(
  '/me/addresses/:id',
  validate({ body: addressBody.partial() }),
  ah(async (req, res) => {
    const userId = req.user!.id;
    const address = await db.transaction(async (tx) => {
      if (req.body.isDefault) await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), ne(addresses.id, req.params.id)));
      const [a] = await tx
        .update(addresses)
        .set(req.body)
        .where(and(eq(addresses.id, req.params.id), eq(addresses.userId, userId)))
        .returning();
      return a;
    });
    if (!address) throw notFound('Address');
    res.json({ address });
  }),
);

usersRouter.delete(
  '/me/addresses/:id',
  ah(async (req, res) => {
    const userId = req.user!.id;
    const [deleted] = await db.delete(addresses).where(and(eq(addresses.id, req.params.id), eq(addresses.userId, userId))).returning();
    if (!deleted) throw notFound('Address');
    if (deleted.isDefault) {
      const next = await db.query.addresses.findFirst({ where: eq(addresses.userId, userId), orderBy: desc(addresses.updatedAt) });
      if (next) await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
    }
    res.json({ ok: true });
  }),
);
