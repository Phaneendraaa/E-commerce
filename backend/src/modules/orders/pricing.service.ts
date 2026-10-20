import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db, schema, type Tx } from '../../db';
import { getSettings, type StoreSettings } from '../settings/settings.service';
import { descendantIds } from '../catalog/catalog.service';
import { formatINR } from '../../utils/format';

const { productVariants, products, coupons, couponRedemptions, orders } = schema;

export interface LineInput {
  variantId: string;
  quantity: number;
}

export interface PricedLine {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  categoryId: string;
  variantTitle: string;
  options: Record<string, string>;
  sku: string;
  image: string | null;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  quantity: number;
  total: number;
  stock: number;
  taxRate: number;
  available: boolean;
  /** Human-readable problem, e.g. "Only 2 left" or "No longer available". */
  issue?: string;
}

export interface CouponResult {
  code: string;
  valid: boolean;
  discount: number;
  freeShipping: boolean;
  message: string;
  couponId?: string;
}

export interface Quote {
  lines: PricedLine[];
  itemCount: number;
  mrpTotal: number;
  subtotal: number;
  savings: number;
  discount: number;
  coupon: CouponResult | null;
  shippingFee: number;
  codFee: number;
  loyaltyDiscount: number;
  loyaltyPointsUsed: number;
  loyaltyPointsAvailable: number;
  maxLoyaltyPoints: number;
  tax: number;
  total: number;
  freeShippingRemaining: number;
  pointsToEarn: number;
  hasIssues: boolean;
  codAvailable: boolean;
}

export async function priceLines(items: LineInput[], tx: Tx = db): Promise<PricedLine[]> {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.quantity);
  const ids = [...merged.keys()].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!ids.length) return [];

  const rows = await tx
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      categoryId: products.categoryId,
      variantTitle: productVariants.title,
      options: productVariants.options,
      sku: productVariants.sku,
      variantImage: productVariants.image,
      images: products.images,
      price: productVariants.price,
      compareAtPrice: productVariants.compareAtPrice,
      costPrice: productVariants.costPrice,
      stock: productVariants.stock,
      taxRate: products.taxRate,
      variantActive: productVariants.isActive,
      productActive: products.isActive,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, ids));

  return rows.map((r) => {
    const quantity = merged.get(r.variantId)!;
    const active = r.variantActive && r.productActive;
    let issue: string | undefined;
    if (!active) issue = 'No longer available';
    else if (r.stock <= 0) issue = 'Out of stock';
    else if (r.stock < quantity) issue = `Only ${r.stock} left in stock`;
    return {
      variantId: r.variantId,
      productId: r.productId,
      productName: r.productName,
      productSlug: r.productSlug,
      categoryId: r.categoryId,
      variantTitle: r.variantTitle,
      options: r.options,
      sku: r.sku,
      image: r.variantImage ?? r.images[0] ?? null,
      price: r.price,
      compareAtPrice: r.compareAtPrice,
      costPrice: r.costPrice,
      quantity,
      total: r.price * quantity,
      stock: r.stock,
      taxRate: r.taxRate,
      available: !issue,
      issue,
    };
  });
}

export async function evaluateCoupon(code: string, lines: PricedLine[], userId: string | null, tx: Tx = db): Promise<CouponResult> {
  const upper = code.trim().toUpperCase();
  const fail = (message: string): CouponResult => ({ code: upper, valid: false, discount: 0, freeShipping: false, message });
  const c = await tx.query.coupons.findFirst({ where: eq(coupons.code, upper) });
  const now = new Date();
  if (!c || !c.isActive) return fail('This coupon code is invalid');
  if (c.startsAt && c.startsAt > now) return fail('This coupon is not active yet');
  if (c.endsAt && c.endsAt < now) return fail('This coupon has expired');
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return fail('This coupon has reached its usage limit');

  if (userId) {
    const used = await tx.$count(couponRedemptions, and(eq(couponRedemptions.couponId, c.id), eq(couponRedemptions.userId, userId)));
    if (used >= c.perUserLimit) return fail(c.perUserLimit === 1 ? 'You have already used this coupon' : 'You have reached the usage limit for this coupon');
    if (c.firstOrderOnly) {
      const prior = await tx.$count(orders, and(eq(orders.userId, userId), notInArray(orders.status, ['CANCELLED', 'FAILED', 'PENDING_PAYMENT'])));
      if (prior > 0) return fail('This coupon is valid on your first order only');
    }
  }

  let eligible = lines.filter((l) => l.available);
  if (c.applicableCategoryIds.length) {
    const allowed = new Set((await Promise.all(c.applicableCategoryIds.map(descendantIds))).flat());
    eligible = eligible.filter((l) => allowed.has(l.categoryId));
    if (!eligible.length) return fail('This coupon does not apply to the items in your cart');
  }
  const base = eligible.reduce((s, l) => s + l.total, 0);
  if (base < c.minOrderValue) return fail(`Add ${formatINR(c.minOrderValue - base)} more to use this coupon`);

  let discount = 0;
  if (c.type === 'PERCENT') discount = Math.round((base * c.value) / 100);
  if (c.type === 'FLAT') discount = c.value;
  if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  discount = Math.min(discount, base);

  return {
    code: upper,
    valid: true,
    discount,
    freeShipping: c.type === 'FREE_SHIPPING',
    couponId: c.id,
    message: c.type === 'FREE_SHIPPING' ? 'Free shipping applied!' : `You saved ${formatINR(discount)} with ${upper}`,
  };
}

export interface QuoteOptions {
  userId?: string | null;
  couponCode?: string | null;
  paymentMethod?: 'RAZORPAY' | 'COD';
  loyaltyPoints?: number;
  settings?: StoreSettings;
}

/** Single source of truth for cart/checkout totals. All amounts in paise; prices are GST-inclusive. */
export async function buildQuote(items: LineInput[], opts: QuoteOptions = {}, tx: Tx = db): Promise<Quote> {
  const s = opts.settings ?? (await getSettings());
  const lines = await priceLines(items, tx);
  const live = lines.filter((l) => l.available);

  const subtotal = live.reduce((sum, l) => sum + l.total, 0);
  const mrpTotal = live.reduce((sum, l) => sum + (l.compareAtPrice && l.compareAtPrice > l.price ? l.compareAtPrice : l.price) * l.quantity, 0);
  const coupon = opts.couponCode ? await evaluateCoupon(opts.couponCode, lines, opts.userId ?? null, tx) : null;
  const discount = coupon?.valid ? coupon.discount : 0;

  const afterDiscount = subtotal - discount;
  const freeShip = coupon?.valid && coupon.freeShipping;
  const shippingFee = subtotal === 0 || freeShip || afterDiscount >= s.freeShippingThreshold ? 0 : s.shippingFee;
  const codAvailable = s.codEnabled && afterDiscount <= s.codMaxOrderValue;
  const codFee = opts.paymentMethod === 'COD' && codAvailable ? s.codFee : 0;

  // Loyalty points
  let loyaltyPointsAvailable = 0;
  if (opts.userId) {
    const u = await tx.query.users.findFirst({ where: eq(schema.users.id, opts.userId), columns: { loyaltyPoints: true } });
    loyaltyPointsAvailable = u?.loyaltyPoints ?? 0;
  }
  const maxByPercent = Math.floor(((afterDiscount * s.loyaltyMaxRedeemPercent) / 100) / s.loyaltyPointValue);
  const maxLoyaltyPoints = Math.max(0, Math.min(loyaltyPointsAvailable, maxByPercent));
  const loyaltyPointsUsed = Math.max(0, Math.min(opts.loyaltyPoints ?? 0, maxLoyaltyPoints));
  const loyaltyDiscount = loyaltyPointsUsed * s.loyaltyPointValue;

  const total = Math.max(0, afterDiscount - loyaltyDiscount + shippingFee + codFee);
  // GST is included in item prices; apportion the discount proportionally to compute tax for the invoice.
  const ratio = subtotal ? (subtotal - discount - loyaltyDiscount) / subtotal : 0;
  const tax = Math.round(live.reduce((sum, l) => sum + (l.total * ratio * l.taxRate) / (100 + l.taxRate), 0));

  return {
    lines,
    itemCount: live.reduce((n, l) => n + l.quantity, 0),
    mrpTotal,
    subtotal,
    savings: mrpTotal - subtotal + discount + loyaltyDiscount,
    discount,
    coupon,
    shippingFee,
    codFee,
    loyaltyDiscount,
    loyaltyPointsUsed,
    loyaltyPointsAvailable,
    maxLoyaltyPoints,
    tax,
    total,
    freeShippingRemaining: freeShip ? 0 : Math.max(0, s.freeShippingThreshold - afterDiscount),
    pointsToEarn: Math.floor(total / 10000) * s.loyaltyEarnPer100,
    hasIssues: lines.some((l) => !l.available),
    codAvailable,
  };
}

/** Atomically reserve stock; throws if any line can't be fulfilled. */
export async function reserveStock(tx: Tx, lines: { variantId: string; quantity: number }[]) {
  for (const l of lines) {
    const res = await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} - ${l.quantity}` })
      .where(and(eq(productVariants.id, l.variantId), sql`${productVariants.stock} >= ${l.quantity}`))
      .returning({ id: productVariants.id });
    if (!res.length) return l.variantId;
  }
  return null;
}

export async function releaseStock(tx: Tx, lines: { variantId: string; quantity: number }[]) {
  for (const l of lines) {
    await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${l.quantity}` })
      .where(eq(productVariants.id, l.variantId));
  }
}

