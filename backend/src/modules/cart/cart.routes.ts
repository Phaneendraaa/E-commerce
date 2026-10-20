import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { badRequest, notFound } from '../../utils/errors';
import { buildQuote } from '../orders/pricing.service';

const { carts, cartItems, productVariants } = schema;
const MAX_QTY = 10;

export const cartRouter = Router();

export async function getOrCreateCart(userId: string) {
  const existing = await db.query.carts.findFirst({ where: eq(carts.userId, userId) });
  if (existing) return existing;
  const [created] = await db.insert(carts).values({ userId }).onConflictDoNothing().returning();
  return created ?? (await db.query.carts.findFirst({ where: eq(carts.userId, userId) }))!;
}

async function cartResponse(userId: string, paymentMethod?: 'RAZORPAY' | 'COD', loyaltyPoints?: number) {
  const cart = await getOrCreateCart(userId);
  const items = await db.query.cartItems.findMany({ where: eq(cartItems.cartId, cart.id), columns: { variantId: true, quantity: true } });
  const quote = await buildQuote(items, { userId, couponCode: cart.couponCode, paymentMethod, loyaltyPoints });
  // Drop a coupon that is no longer valid so it doesn't linger silently
  if (cart.couponCode && quote.coupon && !quote.coupon.valid && items.length === 0) {
    await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
  }
  return { cart: { id: cart.id, couponCode: cart.couponCode, ...quote } };
}

async function touch(cartId: string) {
  // Any activity resets the abandoned-cart clock
  await db.update(carts).set({ lastActivityAt: new Date(), reminderCount: 0, lastReminderAt: null }).where(eq(carts.id, cartId));
}

/** Price an arbitrary list of items (used for guest carts kept in localStorage). */
cartRouter.post(
  '/quote',
  optionalAuth,
  validate({
    body: z.object({
      items: z.array(z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(MAX_QTY) })).max(50),
      couponCode: z.string().trim().max(30).optional().nullable(),
      paymentMethod: z.enum(['RAZORPAY', 'COD']).optional(),
      loyaltyPoints: z.number().int().min(0).optional(),
    }),
  }),
  ah(async (req, res) => {
    const quote = await buildQuote(req.body.items, { userId: req.user?.id, couponCode: req.body.couponCode, paymentMethod: req.body.paymentMethod, loyaltyPoints: req.body.loyaltyPoints });
    res.json({ cart: { id: null, couponCode: req.body.couponCode ?? null, ...quote } });
  }),
);

cartRouter.use(requireAuth);

cartRouter.get(
  '/',
  validate({ query: z.object({ paymentMethod: z.enum(['RAZORPAY', 'COD']).optional(), loyaltyPoints: z.coerce.number().int().min(0).optional() }) }),
  ah(async (req, res) => {
    res.json(await cartResponse(req.user!.id, req.query.paymentMethod as any, req.query.loyaltyPoints as any));
  }),
);

cartRouter.post(
  '/items',
  validate({ body: z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(MAX_QTY).default(1) }) }),
  ah(async (req, res) => {
    const variant = await db.query.productVariants.findFirst({ where: eq(productVariants.id, req.body.variantId), columns: { id: true, stock: true, isActive: true } });
    if (!variant || !variant.isActive) throw notFound('Product');
    if (variant.stock <= 0) throw badRequest('Sorry, this item is out of stock');
    const cart = await getOrCreateCart(req.user!.id);
    const existing = await db.query.cartItems.findFirst({ where: and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variant.id)) });
    const qty = Math.min(MAX_QTY, variant.stock, (existing?.quantity ?? 0) + req.body.quantity);
    await db
      .insert(cartItems)
      .values({ cartId: cart.id, variantId: variant.id, quantity: qty })
      .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: qty } });
    await touch(cart.id);
    res.status(201).json(await cartResponse(req.user!.id));
  }),
);

cartRouter.patch(
  '/items/:variantId',
  validate({ body: z.object({ quantity: z.number().int().min(0).max(MAX_QTY) }) }),
  ah(async (req, res) => {
    const cart = await getOrCreateCart(req.user!.id);
    if (req.body.quantity === 0) {
      await db.delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, req.params.variantId)));
    } else {
      await db.update(cartItems).set({ quantity: req.body.quantity }).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, req.params.variantId)));
    }
    await touch(cart.id);
    res.json(await cartResponse(req.user!.id));
  }),
);

cartRouter.delete(
  '/items/:variantId',
  ah(async (req, res) => {
    const cart = await getOrCreateCart(req.user!.id);
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, req.params.variantId)));
    await touch(cart.id);
    res.json(await cartResponse(req.user!.id));
  }),
);

cartRouter.delete(
  '/',
  ah(async (req, res) => {
    const cart = await getOrCreateCart(req.user!.id);
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
    res.json(await cartResponse(req.user!.id));
  }),
);

/** Merge a guest (localStorage) cart into the user's cart after login. */
cartRouter.post(
  '/merge',
  validate({ body: z.object({ items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(MAX_QTY) })).max(50), couponCode: z.string().optional().nullable() }) }),
  ah(async (req, res) => {
    const cart = await getOrCreateCart(req.user!.id);
    for (const item of req.body.items) {
      const v = await db.query.productVariants.findFirst({ where: eq(productVariants.id, item.variantId), columns: { stock: true, isActive: true } });
      if (!v || !v.isActive || v.stock <= 0) continue;
      const existing = await db.query.cartItems.findFirst({ where: and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, item.variantId)) });
      const qty = Math.min(MAX_QTY, v.stock, Math.max(existing?.quantity ?? 0, item.quantity));
      await db
        .insert(cartItems)
        .values({ cartId: cart.id, variantId: item.variantId, quantity: qty })
        .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: qty } });
    }
    if (req.body.couponCode && !cart.couponCode) await db.update(carts).set({ couponCode: req.body.couponCode.toUpperCase() }).where(eq(carts.id, cart.id));
    await touch(cart.id);
    res.json(await cartResponse(req.user!.id));
  }),
);

cartRouter.post(
  '/coupon',
  validate({ body: z.object({ code: z.string().trim().min(2).max(30) }) }),
  ah(async (req, res) => {
    const cart = await getOrCreateCart(req.user!.id);
    const items = await db.query.cartItems.findMany({ where: eq(cartItems.cartId, cart.id), columns: { variantId: true, quantity: true } });
    const quote = await buildQuote(items, { userId: req.user!.id, couponCode: req.body.code });
    if (!quote.coupon?.valid) throw badRequest(quote.coupon?.message ?? 'Invalid coupon');
    await db.update(carts).set({ couponCode: quote.coupon.code }).where(eq(carts.id, cart.id));
    res.json({ ...(await cartResponse(req.user!.id)), message: quote.coupon.message });
  }),
);

cartRouter.delete(
  '/coupon',
  ah(async (req, res) => {
    const cart = await getOrCreateCart(req.user!.id);
    await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
    res.json(await cartResponse(req.user!.id));
  }),
);
