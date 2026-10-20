import { Router } from 'express';
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import slugify from 'slugify';
import { db, schema } from '../../db';
import { ah, pageMeta, paging } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireRole } from '../../middleware/auth';
import { badRequest, notFound } from '../../utils/errors';
import { invalidateCategoryCache, syncProductPrice } from '../catalog/catalog.service';
import { audit, rupees, sendCsv } from './helpers';

const { products, productVariants, categories, brands, orderItems } = schema;
export const adminCatalogRouter = Router();
const manager = requireRole('MANAGER');

const slug = (s: string) => slugify(s, { lower: true, strict: true });

async function uniqueSlug(table: typeof products | typeof categories | typeof brands, base: string, excludeId?: string) {
  let candidate = slug(base) || 'item';
  for (let i = 2; ; i++) {
    const hit = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.slug, candidate), excludeId ? sql`${table.id} <> ${excludeId}` : undefined))
      .limit(1);
    if (!hit.length) return candidate;
    candidate = `${slug(base)}-${i}`;
  }
}

// ───────────── Products ─────────────

adminCatalogRouter.get(
  '/products',
  validate({
    query: z.object({
      q: z.string().optional(),
      category: z.string().uuid().optional(),
      brand: z.string().uuid().optional(),
      status: z.enum(['active', 'inactive', 'all']).default('all'),
      stock: z.enum(['out', 'low', 'in']).optional(),
      sort: z.enum(['newest', 'name', 'price_asc', 'price_desc', 'stock', 'sold']).default('newest'),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(20),
    }),
  }),
  ah(async (req, res) => {
    const q = req.query as any;
    const p = paging(q);
    const stockSql = sql<number>`(select coalesce(sum(v.stock), 0)::int from product_variants v where v.product_id = "products"."id")`;
    const lowSql = sql<number>`(select count(*)::int from product_variants v where v.product_id = "products"."id" and v.is_active and v.stock <= v.low_stock_threshold)`;
    const conds: SQL[] = [];
    if (q.q) conds.push(or(ilike(products.name, `%${q.q}%`), sql`exists (select 1 from product_variants v where v.product_id = "products"."id" and v.sku ilike ${'%' + q.q + '%'})`)!);
    if (q.category) conds.push(eq(products.categoryId, q.category));
    if (q.brand) conds.push(eq(products.brandId, q.brand));
    if (q.status !== 'all') conds.push(eq(products.isActive, q.status === 'active'));
    if (q.stock === 'out') conds.push(sql`${stockSql} = 0`);
    if (q.stock === 'low') conds.push(sql`${lowSql} > 0`);
    if (q.stock === 'in') conds.push(sql`${stockSql} > 0`);
    const where = conds.length ? and(...conds) : undefined;
    const order = { newest: desc(products.createdAt), name: asc(products.name), price_asc: asc(products.price), price_desc: desc(products.price), stock: asc(stockSql), sold: desc(products.soldCount) }[q.sort as string]!;

    const [items, [{ total }]] = await Promise.all([
      db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          image: sql<string | null>`${products.images}[1]`,
          price: products.price,
          compareAtPrice: products.compareAtPrice,
          isActive: products.isActive,
          isFeatured: products.isFeatured,
          soldCount: products.soldCount,
          viewCount: products.viewCount,
          ratingAvg: products.ratingAvg,
          ratingCount: products.ratingCount,
          category: categories.name,
          brand: brands.name,
          stock: stockSql,
          lowStockVariants: lowSql,
          variantCount: sql<number>`(select count(*)::int from product_variants v where v.product_id = "products"."id")`,
          createdAt: products.createdAt,
        })
        .from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .leftJoin(brands, eq(brands.id, products.brandId))
        .where(where)
        .orderBy(order, asc(products.id))
        .limit(p.limit)
        .offset(p.skip),
      db.select({ total: sql<number>`count(*)::int` }).from(products).where(where),
    ]);
    res.json({ items, ...pageMeta(p, total) });
  }),
);

adminCatalogRouter.get(
  '/products/export',
  ah(async (_req, res) => {
    const list = await db
      .select({
        product: products.name,
        slug: products.slug,
        category: categories.name,
        brand: brands.name,
        sku: productVariants.sku,
        variant: productVariants.title,
        price: productVariants.price,
        mrp: productVariants.compareAtPrice,
        cost: productVariants.costPrice,
        stock: productVariants.stock,
        active: products.isActive,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .orderBy(products.name);
    sendCsv(res, `products-${new Date().toISOString().slice(0, 10)}.csv`, list.map((l) => ({ ...l, price: rupees(l.price), mrp: rupees(l.mrp), cost: rupees(l.cost) })));
  }),
);

adminCatalogRouter.get(
  '/products/:id',
  ah(async (req, res) => {
    const p = await db.query.products.findFirst({ where: eq(products.id, req.params.id), with: { variants: { orderBy: asc(productVariants.createdAt) }, category: true, brand: true } });
    if (!p) throw notFound('Product');
    res.json({ product: p });
  }),
);

const variantInput = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(2).max(60),
  title: z.string().trim().max(120).optional(),
  options: z.record(z.string()).default({}),
  price: z.number().int().min(0),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  costPrice: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  image: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

const productInput = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(200).optional(),
  shortDescription: z.string().max(500).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().nullable().optional(),
  images: z.array(z.string().max(500)).max(20).default([]),
  tags: z.array(z.string().trim().max(40)).max(30).default([]),
  specs: z.array(z.object({ label: z.string().max(80), value: z.string().max(300) })).max(40).default([]),
  optionNames: z.array(z.string().trim().max(40)).max(3).default([]),
  taxRate: z.number().int().min(0).max(28).default(18),
  hsnCode: z.string().max(20).nullable().optional(),
  weightGrams: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  dealEndsAt: z.coerce.date().nullable().optional(),
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(500).nullable().optional(),
  variants: z.array(variantInput).min(1, 'Add at least one variant').max(200),
});

async function saveVariants(productId: string, variants: z.infer<typeof variantInput>[]) {
  const keepIds = variants.map((v) => v.id).filter(Boolean) as string[];
  const existing = await db.query.productVariants.findMany({ where: eq(productVariants.productId, productId), columns: { id: true } });
  const toRemove = existing.map((e) => e.id).filter((id) => !keepIds.includes(id));
  if (toRemove.length) {
    // Variants that were ordered must be kept for history → deactivate instead of delete
    const ordered = await db.selectDistinct({ id: orderItems.variantId }).from(orderItems).where(inArray(orderItems.variantId, toRemove));
    const orderedIds = ordered.map((o) => o.id);
    if (orderedIds.length) await db.update(productVariants).set({ isActive: false }).where(inArray(productVariants.id, orderedIds));
    const deletable = toRemove.filter((id) => !orderedIds.includes(id));
    if (deletable.length) await db.delete(productVariants).where(inArray(productVariants.id, deletable));
  }
  for (const v of variants) {
    const data = { ...v, title: v.title || Object.values(v.options).join(' / ') || 'Default', productId };
    if (v.id) await db.update(productVariants).set(data).where(and(eq(productVariants.id, v.id), eq(productVariants.productId, productId)));
    else await db.insert(productVariants).values({ ...data, id: undefined });
  }
  await syncProductPrice(productId);
}

adminCatalogRouter.post(
  '/products',
  manager,
  validate({ body: productInput }),
  ah(async (req, res) => {
    const { variants, ...data } = req.body as z.infer<typeof productInput>;
    const cheapest = [...variants].sort((a, b) => a.price - b.price)[0];
    const [p] = await db
      .insert(products)
      .values({ ...data, slug: await uniqueSlug(products, data.slug || data.name), price: cheapest.price, compareAtPrice: cheapest.compareAtPrice ?? null })
      .returning();
    await saveVariants(p.id, variants);
    await audit(req, 'create', 'product', p.id, { name: p.name });
    res.status(201).json({ product: p });
  }),
);

adminCatalogRouter.put(
  '/products/:id',
  manager,
  validate({ body: productInput }),
  ah(async (req, res) => {
    const { variants, ...data } = req.body as z.infer<typeof productInput>;
    const [p] = await db
      .update(products)
      .set({ ...data, slug: await uniqueSlug(products, data.slug || data.name, req.params.id) })
      .where(eq(products.id, req.params.id))
      .returning();
    if (!p) throw notFound('Product');
    await saveVariants(p.id, variants);
    await audit(req, 'update', 'product', p.id, { name: p.name });
    res.json({ product: p });
  }),
);

adminCatalogRouter.post(
  '/products/:id/duplicate',
  manager,
  ah(async (req, res) => {
    const src = await db.query.products.findFirst({ where: eq(products.id, req.params.id), with: { variants: true } });
    if (!src) throw notFound('Product');
    const { id: _id, createdAt: _c, updatedAt: _u, variants, ...rest } = src;
    const [copy] = await db
      .insert(products)
      .values({ ...rest, name: `${src.name} (Copy)`, slug: await uniqueSlug(products, `${src.slug}-copy`), isActive: false, soldCount: 0, viewCount: 0, ratingAvg: 0, ratingCount: 0 })
      .returning();
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    await db.insert(productVariants).values(variants.map(({ id: _vid, createdAt: _vc, updatedAt: _vu, ...v }) => ({ ...v, productId: copy.id, sku: `${v.sku}-${suffix}` })));
    await audit(req, 'duplicate', 'product', copy.id, { from: src.id });
    res.status(201).json({ product: copy });
  }),
);

adminCatalogRouter.delete(
  '/products/:id',
  manager,
  ah(async (req, res) => {
    const ordered = await db.$count(orderItems, eq(orderItems.productId, req.params.id));
    if (ordered) {
      await db.update(products).set({ isActive: false }).where(eq(products.id, req.params.id));
      await audit(req, 'archive', 'product', req.params.id);
      return void res.json({ ok: true, archived: true, message: 'Product has order history, so it was archived (hidden) instead of deleted.' });
    }
    await db.delete(products).where(eq(products.id, req.params.id));
    await audit(req, 'delete', 'product', req.params.id);
    res.json({ ok: true });
  }),
);

adminCatalogRouter.post(
  '/products/bulk',
  manager,
  validate({ body: z.object({ ids: z.array(z.string().uuid()).min(1).max(500), action: z.enum(['activate', 'deactivate', 'feature', 'unfeature', 'mark_new', 'unmark_new']) }) }),
  ah(async (req, res) => {
    const patch = {
      activate: { isActive: true },
      deactivate: { isActive: false },
      feature: { isFeatured: true },
      unfeature: { isFeatured: false },
      mark_new: { isNewArrival: true },
      unmark_new: { isNewArrival: false },
    }[req.body.action as string]!;
    await db.update(products).set(patch).where(inArray(products.id, req.body.ids));
    await audit(req, `bulk_${req.body.action}`, 'product', null, { count: req.body.ids.length });
    res.json({ ok: true, updated: req.body.ids.length });
  }),
);

/** Quick stock / price edits from the inventory screen. */
adminCatalogRouter.patch(
  '/variants/:id',
  manager,
  validate({ body: z.object({ stock: z.number().int().min(0).optional(), adjust: z.number().int().optional(), price: z.number().int().min(0).optional(), compareAtPrice: z.number().int().min(0).nullable().optional(), isActive: z.boolean().optional(), lowStockThreshold: z.number().int().min(0).optional() }) }),
  ah(async (req, res) => {
    const { adjust, ...rest } = req.body;
    const patch: Record<string, unknown> = { ...rest };
    if (adjust !== undefined) patch.stock = sql`greatest(${productVariants.stock} + ${adjust}, 0)`;
    const [v] = await db.update(productVariants).set(patch).where(eq(productVariants.id, req.params.id)).returning();
    if (!v) throw notFound('Variant');
    if (req.body.price !== undefined || req.body.isActive !== undefined) await syncProductPrice(v.productId);
    await audit(req, 'update', 'variant', v.id, req.body);
    res.json({ variant: v });
  }),
);

// ───────────── Categories ─────────────

const categoryInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().max(1000).nullable().optional(),
  image: z.string().max(500).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(500).nullable().optional(),
});

adminCatalogRouter.get(
  '/categories',
  ah(async (_req, res) => {
    const list = await db
      .select({ category: categories, productCount: sql<number>`(select count(*)::int from products p where p.category_id = "categories"."id")` })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    res.json({ categories: list.map((l) => ({ ...l.category, productCount: l.productCount })) });
  }),
);

adminCatalogRouter.post(
  '/categories',
  manager,
  validate({ body: categoryInput }),
  ah(async (req, res) => {
    const [c] = await db
      .insert(categories)
      .values({ ...req.body, slug: await uniqueSlug(categories, req.body.slug || req.body.name) })
      .returning();
    invalidateCategoryCache();
    await audit(req, 'create', 'category', c.id);
    res.status(201).json({ category: c });
  }),
);

adminCatalogRouter.put(
  '/categories/:id',
  manager,
  validate({ body: categoryInput }),
  ah(async (req, res) => {
    if (req.body.parentId === req.params.id) throw badRequest('A category cannot be its own parent');
    const [c] = await db
      .update(categories)
      .set({ ...req.body, slug: await uniqueSlug(categories, req.body.slug || req.body.name, req.params.id) })
      .where(eq(categories.id, req.params.id))
      .returning();
    if (!c) throw notFound('Category');
    invalidateCategoryCache();
    await audit(req, 'update', 'category', c.id);
    res.json({ category: c });
  }),
);

adminCatalogRouter.delete(
  '/categories/:id',
  manager,
  ah(async (req, res) => {
    const n = await db.$count(products, eq(products.categoryId, req.params.id));
    if (n) throw badRequest(`Move or delete the ${n} product(s) in this category first`);
    await db.update(categories).set({ parentId: null }).where(eq(categories.parentId, req.params.id));
    await db.delete(categories).where(eq(categories.id, req.params.id));
    invalidateCategoryCache();
    await audit(req, 'delete', 'category', req.params.id);
    res.json({ ok: true });
  }),
);

// ───────────── Brands ─────────────

const brandInput = z.object({ name: z.string().trim().min(1).max(80), logo: z.string().max(500).nullable().optional(), isActive: z.boolean().default(true) });

adminCatalogRouter.get(
  '/brands',
  ah(async (_req, res) => {
    const list = await db
      .select({ brand: brands, productCount: sql<number>`(select count(*)::int from products p where p.brand_id = "brands"."id")` })
      .from(brands)
      .orderBy(brands.name);
    res.json({ brands: list.map((l) => ({ ...l.brand, productCount: l.productCount })) });
  }),
);

adminCatalogRouter.post(
  '/brands',
  manager,
  validate({ body: brandInput }),
  ah(async (req, res) => {
    const [b] = await db
      .insert(brands)
      .values({ ...req.body, slug: await uniqueSlug(brands, req.body.name) })
      .returning();
    res.status(201).json({ brand: b });
  }),
);

adminCatalogRouter.put(
  '/brands/:id',
  manager,
  validate({ body: brandInput }),
  ah(async (req, res) => {
    const [b] = await db
      .update(brands)
      .set({ ...req.body, slug: await uniqueSlug(brands, req.body.name, req.params.id) })
      .where(eq(brands.id, req.params.id))
      .returning();
    if (!b) throw notFound('Brand');
    res.json({ brand: b });
  }),
);

adminCatalogRouter.delete(
  '/brands/:id',
  manager,
  ah(async (req, res) => {
    await db.update(products).set({ brandId: null }).where(eq(products.brandId, req.params.id));
    await db.delete(brands).where(eq(brands.id, req.params.id));
    res.json({ ok: true });
  }),
);

