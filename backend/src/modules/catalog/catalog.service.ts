import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { db, schema, type Tx } from '../../db';

const { products, productVariants, categories, brands } = schema;

// ───────────── Category tree (small table → cached in memory) ─────────────

type CategoryRow = typeof categories.$inferSelect;
let catCache: { rows: CategoryRow[]; at: number } | null = null;

export async function allCategories(): Promise<CategoryRow[]> {
  if (catCache && Date.now() - catCache.at < 60_000) return catCache.rows;
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  catCache = { rows, at: Date.now() };
  return rows;
}
export const invalidateCategoryCache = () => (catCache = null);

export async function categoryTree() {
  const rows = (await allCategories()).filter((c) => c.isActive);
  const counts = await db
    .select({ categoryId: products.categoryId, n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.isActive, true))
    .groupBy(products.categoryId);
  const countMap = new Map(counts.map((c) => [c.categoryId, c.n]));
  type Node = CategoryRow & { productCount: number; children: Node[] };
  const nodes = new Map<string, Node>(rows.map((r) => [r.id, { ...r, productCount: countMap.get(r.id) ?? 0, children: [] }]));
  const roots: Node[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const total = (n: Node): number => (n.productCount += n.children.reduce((s, c) => s + total(c), 0)) && n.productCount;
  roots.forEach(total);
  return roots;
}

export async function descendantIds(categoryId: string): Promise<string[]> {
  const rows = await allCategories();
  const out = [categoryId];
  for (let i = 0; i < out.length; i++) rows.filter((r) => r.parentId === out[i]).forEach((r) => out.push(r.id));
  return out;
}

export async function breadcrumb(categoryId: string) {
  const rows = await allCategories();
  const trail: { name: string; slug: string }[] = [];
  let cur = rows.find((r) => r.id === categoryId);
  while (cur) {
    trail.unshift({ name: cur.name, slug: cur.slug });
    cur = cur.parentId ? rows.find((r) => r.id === cur!.parentId) : undefined;
  }
  return trail;
}

// ───────────── Product cards ─────────────

const stockExpr = sql<number>`(select coalesce(sum(v.stock), 0)::int from product_variants v where v.product_id = "products"."id" and v.is_active)`;

export const cardColumns = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  images: products.images,
  price: products.price,
  compareAtPrice: products.compareAtPrice,
  ratingAvg: products.ratingAvg,
  ratingCount: products.ratingCount,
  soldCount: products.soldCount,
  isNewArrival: products.isNewArrival,
  isFeatured: products.isFeatured,
  dealEndsAt: products.dealEndsAt,
  shortDescription: products.shortDescription,
  brandName: brands.name,
  categoryId: products.categoryId,
  stock: stockExpr,
};

export type ProductCard = Awaited<ReturnType<typeof fetchCards>>[number];

function decorate<T extends { price: number; compareAtPrice: number | null; stock: number }>(rows: T[]) {
  return rows.map((r) => ({
    ...r,
    inStock: r.stock > 0,
    discountPercent: r.compareAtPrice && r.compareAtPrice > r.price ? Math.round(((r.compareAtPrice - r.price) / r.compareAtPrice) * 100) : 0,
  }));
}

export async function fetchCards(where: SQL | undefined, order: SQL[] = [desc(products.createdAt)], limit = 12, offset = 0) {
  const rows = await db
    .select(cardColumns)
    .from(products)
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(where)
    .orderBy(...order)
    .limit(limit)
    .offset(offset);
  return decorate(rows);
}

export async function cardsByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await fetchCards(and(inArray(products.id, ids), eq(products.isActive, true)), [desc(products.createdAt)], ids.length);
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter(Boolean) as typeof rows;
}

// ───────────── Listing with filters & facets ─────────────

export interface ListQuery {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStock?: boolean;
  onSale?: boolean;
  featured?: boolean;
  newArrival?: boolean;
  deals?: boolean;
  tag?: string;
  options?: string; // "Size:M|L,Color:Black"
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'rating' | 'discount';
  page: number;
  limit: number;
}

export async function listProducts(q: ListQuery) {
  const conds: SQL[] = [eq(products.isActive, true)];
  let category: CategoryRow | undefined;

  if (q.category) {
    category = (await allCategories()).find((c) => c.slug === q.category);
    if (!category) return { items: [], total: 0, facets: emptyFacets(), category: null };
    conds.push(inArray(products.categoryId, await descendantIds(category.id)));
  }

  const tsQuery = q.q?.trim() ? sql`websearch_to_tsquery('english', ${q.q.trim()})` : null;
  const tsVector = sql`to_tsvector('english', coalesce(${products.name}, '') || ' ' || coalesce(${products.shortDescription}, ''))`;
  if (q.q?.trim()) {
    const like = `%${q.q.trim()}%`;
    conds.push(
      or(
        sql`${tsVector} @@ ${tsQuery}`,
        ilike(products.name, like),
        sql`exists (select 1 from unnest(${products.tags}) t where t ilike ${like})`,
        sql`exists (select 1 from brands b where b.id = ${products.brandId} and b.name ilike ${like})`,
      )!,
    );
  }

  // Base conditions (before brand/price/option filters) are used for facets so users can still widen filters.
  const facetBase = and(...conds);

  if (q.brand) {
    const slugs = q.brand.split(',').filter(Boolean);
    conds.push(sql`${products.brandId} in (select id from brands where slug in ${slugs})`);
  }
  if (q.minPrice !== undefined) conds.push(gte(products.price, q.minPrice));
  if (q.maxPrice !== undefined) conds.push(lte(products.price, q.maxPrice));
  if (q.rating) conds.push(gte(products.ratingAvg, q.rating));
  if (q.inStock) conds.push(sql`${stockExpr} > 0`);
  if (q.onSale) conds.push(sql`${products.compareAtPrice} > ${products.price}`);
  if (q.featured) conds.push(eq(products.isFeatured, true));
  if (q.newArrival) conds.push(eq(products.isNewArrival, true));
  if (q.deals) conds.push(sql`${products.dealEndsAt} > now()`);
  if (q.tag) conds.push(sql`${q.tag} = any(${products.tags})`);
  if (q.options) {
    for (const part of q.options.split(',')) {
      const [name, vals] = part.split(':');
      const values = (vals ?? '').split('|').filter(Boolean);
      if (!name || !values.length) continue;
      conds.push(
        sql`exists (select 1 from product_variants v where v.product_id = "products"."id" and v.is_active and v.options->>${name} in ${values})`,
      );
    }
  }

  const where = and(...conds);
  const discountExpr = sql`case when ${products.compareAtPrice} > ${products.price} then (${products.compareAtPrice} - ${products.price})::float / ${products.compareAtPrice} else 0 end`;
  const order: SQL[] = (() => {
    switch (q.sort) {
      case 'price_asc':
        return [asc(products.price)];
      case 'price_desc':
        return [desc(products.price)];
      case 'popular':
        return [desc(products.soldCount), desc(products.viewCount)];
      case 'rating':
        return [desc(products.ratingAvg), desc(products.ratingCount)];
      case 'discount':
        return [desc(discountExpr)];
      case 'newest':
        return [desc(products.createdAt)];
      default:
        return tsQuery ? [desc(sql`ts_rank(${tsVector}, ${tsQuery})`), desc(products.soldCount)] : [desc(products.isFeatured), desc(products.soldCount), desc(products.createdAt)];
    }
  })();

  const [items, [{ total }], facets] = await Promise.all([
    fetchCards(where, [...order, asc(products.id)], q.limit, (q.page - 1) * q.limit),
    db.select({ total: sql<number>`count(*)::int` }).from(products).where(where),
    buildFacets(facetBase),
  ]);

  return { items, total, facets, category };
}

function emptyFacets() {
  return { brands: [], price: { min: 0, max: 0 }, options: {} as Record<string, string[]>, ratings: [] as { rating: number; count: number }[] };
}

async function buildFacets(where: SQL | undefined) {
  const [brandRows, [price], optionRows, ratingRows] = await Promise.all([
    db
      .select({ name: brands.name, slug: brands.slug, count: sql<number>`count(*)::int` })
      .from(products)
      .innerJoin(brands, eq(brands.id, products.brandId))
      .where(where)
      .groupBy(brands.name, brands.slug)
      .orderBy(desc(sql`count(*)`)),
    db.select({ min: sql<number>`coalesce(min(${products.price}), 0)::int`, max: sql<number>`coalesce(max(${products.price}), 0)::int` }).from(products).where(where),
    db.execute<{ key: string; value: string }>(sql`
      select distinct o.key, o.value
      from ${products}
      join product_variants v on v.product_id = "products"."id" and v.is_active
      cross join lateral jsonb_each_text(v.options) o
      where ${where ?? sql`true`}
      order by o.key, o.value`),
    db
      .select({ rating: sql<number>`floor(${products.ratingAvg})::int`, count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(where, gte(products.ratingCount, 1)))
      .groupBy(sql`1`),
  ]);

  const options: Record<string, string[]> = {};
  for (const r of optionRows.rows) (options[r.key] ??= []).push(r.value);
  // "at least N stars" counts
  const ratings = [4, 3, 2, 1].map((n) => ({ rating: n, count: ratingRows.filter((r) => r.rating >= n).reduce((s, r) => s + r.count, 0) }));
  return { brands: brandRows, price, options, ratings };
}

// ───────────── Product detail ─────────────

export async function productBySlug(slug: string) {
  const p = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.isActive, true)),
    with: {
      brand: true,
      category: true,
      variants: { where: eq(productVariants.isActive, true), orderBy: asc(productVariants.price) },
    },
  });
  if (!p) return null;

  const [crumbs, dist] = await Promise.all([
    breadcrumb(p.categoryId),
    db
      .select({ rating: schema.reviews.rating, count: sql<number>`count(*)::int` })
      .from(schema.reviews)
      .where(and(eq(schema.reviews.productId, p.id), eq(schema.reviews.status, 'APPROVED')))
      .groupBy(schema.reviews.rating),
  ]);

  const ratingBreakdown = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?.count ?? 0 }));
  const variants = p.variants.map(({ costPrice: _c, ...v }) => ({ ...v, inStock: v.stock > 0, lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold }));
  const totalStock = variants.reduce((s, v) => s + v.stock, 0);

  // Option values in the order they appear in variants
  const optionValues: Record<string, string[]> = {};
  for (const name of p.optionNames) optionValues[name] = [...new Set(variants.map((v) => v.options[name]).filter(Boolean))];

  return {
    ...p,
    variants,
    optionValues,
    breadcrumb: crumbs,
    ratingBreakdown,
    inStock: totalStock > 0,
    discountPercent: p.compareAtPrice && p.compareAtPrice > p.price ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100) : 0,
  };
}

export async function relatedProducts(productId: string, categoryId: string, limit = 8) {
  return fetchCards(and(eq(products.categoryId, categoryId), eq(products.isActive, true), sql`${products.id} <> ${productId}`), [desc(products.soldCount), desc(products.ratingAvg)], limit);
}

/** Products most often bought in the same order as this one. */
export async function frequentlyBoughtTogether(productId: string, limit = 3) {
  const rows = await db.execute<{ product_id: string }>(sql`
    select oi2.product_id, count(*) as n
    from order_items oi1
    join order_items oi2 on oi2.order_id = oi1.order_id and oi2.product_id <> oi1.product_id
    join orders o on o.id = oi1.order_id and o.status not in ('CANCELLED', 'FAILED', 'PENDING_PAYMENT')
    where oi1.product_id = ${productId}
    group by oi2.product_id
    order by n desc
    limit ${limit}`);
  return cardsByIds(rows.rows.map((r) => r.product_id));
}

export async function suggest(q: string) {
  const like = `%${q.trim()}%`;
  const [items, cats] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, slug: products.slug, image: sql<string | null>`${products.images}[1]`, price: products.price })
      .from(products)
      .where(and(eq(products.isActive, true), or(ilike(products.name, like), sql`exists (select 1 from unnest(${products.tags}) t where t ilike ${like})`)))
      .orderBy(desc(products.soldCount))
      .limit(6),
    db
      .select({ name: categories.name, slug: categories.slug })
      .from(categories)
      .where(and(eq(categories.isActive, true), ilike(categories.name, like)))
      .limit(3),
  ]);
  return { products: items, categories: cats };
}

/** Recompute rating aggregates after a review changes. */
export async function recalcRating(productId: string) {
  await db.execute(sql`
    update products set
      rating_avg = coalesce((select round(avg(rating)::numeric, 1) from reviews where product_id = ${productId} and status = 'APPROVED'), 0),
      rating_count = (select count(*) from reviews where product_id = ${productId} and status = 'APPROVED')
    where id = ${productId}`);
}

/** Keep the denormalized product price in sync with its cheapest active variant. */
export async function syncProductPrice(productId: string, tx: Tx = db) {
  await tx.execute(sql`
    update products p set
      price = coalesce(v.price, p.price),
      compare_at_price = v.compare_at_price
    from (
      select price, compare_at_price from product_variants
      where product_id = ${productId} and is_active
      order by price asc limit 1
    ) v
    where p.id = ${productId}`);
}
