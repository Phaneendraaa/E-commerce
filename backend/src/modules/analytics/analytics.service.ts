import { sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';

/**
 * Advanced store analytics. All queries run directly in Postgres and bucket by
 * Indian Standard Time. "Valid" orders exclude cancelled, failed and unpaid ones.
 */

const TZ = 'Asia/Kolkata';
const VALID = sql.raw(`status not in ('CANCELLED','FAILED','PENDING_PAYMENT')`);
const VALID_O = sql.raw(`o.status not in ('CANCELLED','FAILED','PENDING_PAYMENT')`);

export interface Range {
  from: Date;
  to: Date;
}

export function resolveRange(q: { from?: string; to?: string; days?: number }): Range & { prev: Range; days: number } {
  const to = q.to ? endOfDay(new Date(q.to)) : new Date();
  const from = q.from ? startOfDay(new Date(q.from)) : startOfDay(new Date(to.getTime() - ((q.days ?? 30) - 1) * 86_400_000));
  const span = to.getTime() - from.getTime();
  const days = Math.max(1, Math.round(span / 86_400_000));
  return { from, to, days, prev: { from: new Date(from.getTime() - span - 1), to: new Date(from.getTime() - 1) } };
}

function startOfDay(d: Date) {
  // Midnight IST expressed in UTC
  const ist = new Date(d.getTime() + 5.5 * 3_600_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3_600_000);
}
function endOfDay(d: Date) {
  return new Date(startOfDay(d).getTime() + 86_400_000 - 1);
}

const rows = async <T>(q: SQL) => (await db.execute(q)).rows as T[];
const one = async <T>(q: SQL) => (await rows<T>(q))[0];
const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 1000) / 10);

// ───────────── KPI overview ─────────────

async function kpis(r: Range) {
  const [o, items, cust, sess, refunds] = await Promise.all([
    one<{ revenue: number; orders: number; discount: number; shipping: number; cancelled: number; all_orders: number }>(sql`
      select
        coalesce(sum(total) filter (where ${VALID}), 0)::bigint as revenue,
        count(*) filter (where ${VALID})::int as orders,
        coalesce(sum(discount + loyalty_discount) filter (where ${VALID}), 0)::bigint as discount,
        coalesce(sum(shipping_fee) filter (where ${VALID}), 0)::bigint as shipping,
        count(*) filter (where status = 'CANCELLED')::int as cancelled,
        count(*) filter (where status <> 'PENDING_PAYMENT')::int as all_orders
      from orders where created_at between ${r.from} and ${r.to}`),
    one<{ units: number; cogs: number; item_revenue: number }>(sql`
      select coalesce(sum(oi.quantity), 0)::int as units,
             coalesce(sum(coalesce(oi.cost_price, oi.price * 0.6) * oi.quantity), 0)::bigint as cogs,
             coalesce(sum(oi.total), 0)::bigint as item_revenue
      from order_items oi join orders o on o.id = oi.order_id
      where ${VALID_O} and o.created_at between ${r.from} and ${r.to}`),
    one<{ new_customers: number; buyers: number; returning: number }>(sql`
      with buyers as (
        select user_id, min(created_at) over (partition by user_id) as first_at, created_at
        from orders where ${VALID}
      )
      select
        (select count(*) from users where role = 'CUSTOMER' and created_at between ${r.from} and ${r.to})::int as new_customers,
        count(distinct user_id) filter (where created_at between ${r.from} and ${r.to})::int as buyers,
        count(distinct user_id) filter (where created_at between ${r.from} and ${r.to} and first_at < ${r.from})::int as returning
      from buyers`),
    one<{ sessions: number; purchasers: number }>(sql`
      select count(distinct session_id)::int as sessions,
             count(distinct session_id) filter (where type = 'PURCHASE')::int as purchasers
      from analytics_events where created_at between ${r.from} and ${r.to}`),
    one<{ refunded: number }>(sql`
      select coalesce(sum(total), 0)::bigint as refunded from orders
      where payment_status = 'REFUNDED' and updated_at between ${r.from} and ${r.to}`),
  ]);

  const revenue = Number(o.revenue);
  const orders = o.orders;
  const cogs = Number(items.cogs);
  const itemRevenue = Number(items.item_revenue);
  const discount = Number(o.discount);
  const grossProfit = itemRevenue - discount - cogs;
  return {
    revenue,
    netRevenue: revenue - Number(refunds.refunded),
    orders,
    aov: orders ? Math.round(revenue / orders) : 0,
    units: items.units,
    grossProfit,
    margin: itemRevenue ? Math.round((grossProfit / itemRevenue) * 1000) / 10 : 0,
    discount,
    refunded: Number(refunds.refunded),
    newCustomers: cust.new_customers,
    buyers: cust.buyers,
    returningRate: cust.buyers ? Math.round((cust.returning / cust.buyers) * 1000) / 10 : 0,
    sessions: sess.sessions,
    conversionRate: sess.sessions ? Math.round((sess.purchasers / sess.sessions) * 10000) / 100 : 0,
    cancellationRate: o.all_orders ? Math.round((o.cancelled / o.all_orders) * 1000) / 10 : 0,
  };
}

export async function overview(q: { from?: string; to?: string; days?: number }) {
  const range = resolveRange(q);
  const [cur, prev, spark] = await Promise.all([kpis(range), kpis(range.prev), salesSeries(range, 'day')]);
  const change = Object.fromEntries(Object.keys(cur).map((k) => [k, pct((cur as any)[k], (prev as any)[k])])) as Record<keyof typeof cur, number>;
  return { range: { from: range.from, to: range.to, days: range.days }, current: cur, previous: prev, change, spark };
}

// ───────────── Sales time series ─────────────

export type Granularity = 'day' | 'week' | 'month';

export async function salesSeries(r: Range, g: Granularity = 'day') {
  const unit = sql.raw(`'${g}'`);
  const step = sql.raw(`'1 ${g}'`);
  return rows<{ bucket: string; revenue: number; orders: number; aov: number; units: number; profit: number; customers: number }>(sql`
    with buckets as (
      select generate_series(
        date_trunc(${unit}, ${r.from}::timestamptz at time zone ${TZ}),
        date_trunc(${unit}, ${r.to}::timestamptz at time zone ${TZ}),
        ${step}::interval) as bucket
    ),
    o as (
      select date_trunc(${unit}, created_at at time zone ${TZ}) as bucket, id, total, user_id
      from orders where ${VALID} and created_at between ${r.from} and ${r.to}
    ),
    i as (
      select date_trunc(${unit}, o.created_at at time zone ${TZ}) as bucket,
             sum(oi.quantity) as units,
             sum(oi.total - coalesce(oi.cost_price, oi.price * 0.6) * oi.quantity) as profit
      from order_items oi join orders o on o.id = oi.order_id
      where ${VALID_O} and o.created_at between ${r.from} and ${r.to}
      group by 1
    )
    select to_char(b.bucket, 'YYYY-MM-DD') as bucket,
           coalesce(sum(o.total), 0)::bigint as revenue,
           count(o.id)::int as orders,
           coalesce(round(avg(o.total)), 0)::bigint as aov,
           coalesce(max(i.units), 0)::int as units,
           coalesce(max(i.profit), 0)::bigint as profit,
           count(distinct o.user_id)::int as customers
    from buckets b
    left join o on o.bucket = b.bucket
    left join i on i.bucket = b.bucket
    group by b.bucket order by b.bucket`).then((list) =>
    list.map((x) => ({ ...x, revenue: Number(x.revenue), aov: Number(x.aov), profit: Number(x.profit) })),
  );
}

export async function sales(q: { from?: string; to?: string; days?: number; granularity?: Granularity }) {
  const range = resolveRange(q);
  const g = q.granularity ?? (range.days > 120 ? 'month' : range.days > 45 ? 'week' : 'day');
  const [current, previous] = await Promise.all([salesSeries(range, g), salesSeries(range.prev, g)]);
  return { granularity: g, current, previous };
}

// ───────────── Forecast (linear trend + weekday seasonality) ─────────────

export async function forecast(daysAhead = 14) {
  // Use complete days only (exclude today's partial revenue)
  const yesterday = new Date(startOfDay(new Date()).getTime() - 1);
  const r = { from: startOfDay(new Date(yesterday.getTime() - 55 * 86_400_000)), to: yesterday };
  const series = await salesSeries(r, 'day');
  const ys = series.map((s) => s.revenue);
  const n = ys.length;
  if (n < 14) return { history: series, forecast: [], trendPerDay: 0, projectedTotal: 0 };

  // Least-squares line
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const intercept = my - slope * mx;

  // Weekday multipliers from residual ratios
  const byDow = new Map<number, number[]>();
  series.forEach((s, i) => {
    const dow = new Date(s.bucket + 'T00:00:00+05:30').getDay();
    const fit = intercept + slope * i;
    if (fit > 0) byDow.set(dow, [...(byDow.get(dow) ?? []), ys[i] / fit]);
  });
  const season = (dow: number) => {
    const v = byDow.get(dow);
    return v?.length ? v.reduce((a, b) => a + b, 0) / v.length : 1;
  };
  const residualSd = Math.sqrt(ys.reduce((s, y, i) => s + (y - (intercept + slope * i) * season(new Date(series[i].bucket + 'T00:00:00+05:30').getDay())) ** 2, 0) / n);

  const last = new Date(series[n - 1].bucket + 'T00:00:00+05:30');
  const fc = Array.from({ length: daysAhead }, (_, k) => {
    const d = new Date(last.getTime() + (k + 1) * 86_400_000);
    const value = Math.max(0, Math.round((intercept + slope * (n + k)) * season(d.getDay())));
    const bucket = new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    return { bucket, revenue: value, low: Math.max(0, Math.round(value - 1.28 * residualSd)), high: Math.round(value + 1.28 * residualSd) };
  });
  return { history: series.slice(-28), forecast: fc, trendPerDay: Math.round(slope), projectedTotal: fc.reduce((s, f) => s + f.revenue, 0) };
}

// ───────────── Funnel ─────────────

export async function funnel(q: { from?: string; to?: string; days?: number }) {
  const r = resolveRange(q);
  const f = await one<Record<string, number>>(sql`
    select
      count(distinct session_id)::int as sessions,
      count(distinct session_id) filter (where type = 'PRODUCT_VIEW')::int as product_view,
      count(distinct session_id) filter (where type = 'ADD_TO_CART')::int as add_to_cart,
      count(distinct session_id) filter (where type = 'BEGIN_CHECKOUT')::int as checkout,
      count(distinct session_id) filter (where type = 'ADD_PAYMENT_INFO')::int as payment,
      count(distinct session_id) filter (where type = 'PURCHASE')::int as purchase
    from analytics_events where created_at between ${r.from} and ${r.to}`);
  const steps = [
    { key: 'sessions', label: 'Sessions' },
    { key: 'product_view', label: 'Viewed product' },
    { key: 'add_to_cart', label: 'Added to cart' },
    { key: 'checkout', label: 'Started checkout' },
    { key: 'payment', label: 'Payment info' },
    { key: 'purchase', label: 'Purchased' },
  ].map((s, i, arr) => {
    const count = f[s.key] ?? 0;
    const prev = i ? f[arr[i - 1].key] ?? 0 : count;
    return { ...s, count, ofTotal: f.sessions ? Math.round((count / f.sessions) * 1000) / 10 : 0, fromPrevious: prev ? Math.round((count / prev) * 1000) / 10 : 0, dropOff: prev ? Math.round(((prev - count) / prev) * 1000) / 10 : 0 };
  });
  const cartAbandonment = f.add_to_cart ? Math.round(((f.add_to_cart - f.purchase) / f.add_to_cart) * 1000) / 10 : 0;
  const checkoutAbandonment = f.checkout ? Math.round(((f.checkout - f.purchase) / f.checkout) * 1000) / 10 : 0;
  return { steps, cartAbandonment, checkoutAbandonment };
}

// ───────────── Products & categories ─────────────

export async function topProducts(q: { from?: string; to?: string; days?: number; limit?: number; sort?: string }) {
  const r = resolveRange(q);
  const order = sql.raw(
    { units: 'units desc', views: 'views desc', conversion: 'conversion desc nulls last', profit: 'profit desc', margin: 'margin desc nulls last' }[q.sort ?? ''] ?? 'revenue desc',
  );
  return rows<any>(sql`
    with s as (
      select oi.product_id, sum(oi.quantity)::int as units, sum(oi.total)::bigint as revenue,
             sum(oi.total - coalesce(oi.cost_price, oi.price * 0.6) * oi.quantity)::bigint as profit,
             count(distinct o.id)::int as orders
      from order_items oi join orders o on o.id = oi.order_id
      where ${VALID_O} and o.created_at between ${r.from} and ${r.to}
      group by oi.product_id
    ),
    e as (
      select product_id,
             count(*) filter (where type = 'PRODUCT_VIEW')::int as views,
             count(*) filter (where type = 'ADD_TO_CART')::int as carts,
             count(*) filter (where type = 'WISHLIST_ADD')::int as wishlists
      from analytics_events where product_id is not null and created_at between ${r.from} and ${r.to}
      group by product_id
    )
    select p.id, p.name, p.slug, p.images[1] as image, p.price, p.rating_avg as "ratingAvg", p.rating_count as "ratingCount",
           c.name as category,
           coalesce(s.units, 0) as units, coalesce(s.revenue, 0)::bigint as revenue, coalesce(s.profit, 0)::bigint as profit,
           coalesce(s.orders, 0) as orders,
           case when s.revenue > 0 then round(s.profit::numeric * 100 / s.revenue, 1) end as margin,
           coalesce(e.views, 0) as views, coalesce(e.carts, 0) as carts, coalesce(e.wishlists, 0) as wishlists,
           case when e.views > 0 then round(coalesce(s.orders, 0)::numeric * 100 / e.views, 2) end as conversion,
           case when e.views > 0 then round(e.carts::numeric * 100 / e.views, 1) end as "addToCartRate",
           (select coalesce(sum(stock), 0)::int from product_variants v where v.product_id = p.id and v.is_active) as stock
    from products p
    join categories c on c.id = p.category_id
    left join s on s.product_id = p.id
    left join e on e.product_id = p.id
    order by ${order}
    limit ${q.limit ?? 10}`).then((l) => l.map((x) => ({ ...x, revenue: Number(x.revenue), profit: Number(x.profit), margin: x.margin === null ? null : Number(x.margin), conversion: x.conversion === null ? null : Number(x.conversion), addToCartRate: x.addToCartRate === null ? null : Number(x.addToCartRate) })));
}

export async function categoryBreakdown(q: { from?: string; to?: string; days?: number }) {
  const r = resolveRange(q);
  // Roll sub-categories up to their top-level parent
  return rows<any>(sql`
    with recursive tree as (
      select id, id as root_id, name as root_name from categories where parent_id is null
      union all
      select c.id, t.root_id, t.root_name from categories c join tree t on c.parent_id = t.id
    )
    select t.root_name as category, sum(oi.total)::bigint as revenue, sum(oi.quantity)::int as units, count(distinct o.id)::int as orders
    from order_items oi
    join orders o on o.id = oi.order_id
    join products p on p.id = oi.product_id
    join tree t on t.id = p.category_id
    where ${VALID_O} and o.created_at between ${r.from} and ${r.to}
    group by t.root_name order by revenue desc`).then((l) => {
    const total = l.reduce((s, x) => s + Number(x.revenue), 0);
    return l.map((x) => ({ ...x, revenue: Number(x.revenue), share: total ? Math.round((Number(x.revenue) / total) * 1000) / 10 : 0 }));
  });
}

// ───────────── Customers ─────────────

export async function customers(q: { from?: string; to?: string; days?: number }) {
  const r = resolveRange(q);
  const [newVsReturning, clv, top, segments] = await Promise.all([
    rows<any>(sql`
      with firsts as (select user_id, min(created_at) as first_at from orders where ${VALID} group by user_id)
      select to_char(date_trunc('week', o.created_at at time zone ${TZ}), 'YYYY-MM-DD') as bucket,
             count(distinct o.user_id) filter (where date_trunc('day', f.first_at) = date_trunc('day', o.created_at))::int as "new",
             count(distinct o.user_id) filter (where f.first_at < date_trunc('day', o.created_at))::int as returning
      from orders o join firsts f on f.user_id = o.user_id
      where ${VALID_O} and o.created_at between ${r.from} and ${r.to}
      group by 1 order by 1`),
    one<any>(sql`
      select coalesce(round(avg(spent)), 0)::bigint as clv, coalesce(round(avg(n), 2), 0) as "ordersPerCustomer",
             count(*) filter (where n > 1)::int as repeaters, count(*)::int as customers
      from (select user_id, sum(total) as spent, count(*) as n from orders where ${VALID} group by user_id) x`),
    rows<any>(sql`
      select u.id, u.name, u.email, u.phone, count(o.id)::int as orders, sum(o.total)::bigint as spent, max(o.created_at) as "lastOrderAt"
      from orders o join users u on u.id = o.user_id
      where ${VALID_O}
      group by u.id order by spent desc limit 10`),
    rfmSegments(),
  ]);
  return {
    newVsReturning,
    lifetime: { clv: Number(clv.clv), ordersPerCustomer: Number(clv.ordersPerCustomer), repeatRate: clv.customers ? Math.round((clv.repeaters / clv.customers) * 1000) / 10 : 0, customers: clv.customers },
    topCustomers: top.map((t) => ({ ...t, spent: Number(t.spent) })),
    segments,
  };
}

/** RFM segmentation using quintile scores for Recency, Frequency and Monetary value. */
export async function rfmSegments() {
  const list = await rows<{ segment: string; customers: number; revenue: number; avg_recency: number }>(sql`
    with base as (
      select user_id,
             extract(day from now() - max(created_at))::int as recency,
             count(*)::int as frequency,
             sum(total)::bigint as monetary
      from orders where ${VALID} group by user_id
    ),
    scored as (
      select *, 6 - ntile(5) over (order by recency) as r, ntile(5) over (order by frequency) as f, ntile(5) over (order by monetary) as m from base
    ),
    seg as (
      select *,
        case
          when r >= 4 and f >= 4 and m >= 4 then 'Champions'
          when r >= 3 and f >= 3 then 'Loyal'
          when r >= 4 and f <= 2 then 'New & Promising'
          when r = 3 and f <= 2 then 'Potential Loyalists'
          when r <= 2 and f >= 3 then 'At Risk'
          when r <= 2 and f <= 2 and m >= 3 then 'Can''t Lose Them'
          else 'Hibernating'
        end as segment
      from scored
    )
    select segment, count(*)::int as customers, sum(monetary)::bigint as revenue, round(avg(recency))::int as avg_recency
    from seg group by segment order by revenue desc`);
  return list.map((s) => ({ ...s, revenue: Number(s.revenue) }));
}

/** Monthly acquisition cohorts: % of customers who ordered again N months after their first order. */
export async function cohorts(months = 6) {
  const data = await rows<{ cohort: string; month: number; customers: number }>(sql`
    with firsts as (
      select user_id, date_trunc('month', min(created_at) at time zone ${TZ}) as cohort from orders where ${VALID} group by user_id
    ),
    activity as (
      select distinct o.user_id, f.cohort,
        ((extract(year from date_trunc('month', o.created_at at time zone ${TZ})) - extract(year from f.cohort)) * 12 +
         extract(month from date_trunc('month', o.created_at at time zone ${TZ})) - extract(month from f.cohort))::int as month
      from orders o join firsts f on f.user_id = o.user_id
      where ${VALID_O}
    )
    select to_char(cohort, 'YYYY-MM') as cohort, month, count(distinct user_id)::int as customers
    from activity
    where cohort >= date_trunc('month', now() at time zone ${TZ}) - (${months - 1} || ' months')::interval
    group by 1, 2 order by 1, 2`);
  const map = new Map<string, Map<number, number>>();
  data.forEach((d) => (map.get(d.cohort) ?? map.set(d.cohort, new Map()).get(d.cohort)!).set(d.month, d.customers));
  return [...map.entries()].map(([cohort, m]) => {
    const size = m.get(0) ?? 0;
    return { cohort, size, retention: Array.from({ length: months }, (_, i) => (m.has(i) || i === 0 ? (size ? Math.round(((m.get(i) ?? 0) / size) * 1000) / 10 : 0) : null)) };
  });
}

// ───────────── Geography, traffic, timing ─────────────

export async function geography(q: { from?: string; to?: string; days?: number }) {
  const r = resolveRange(q);
  const [states, cities] = await Promise.all([
    rows<any>(sql`
      select shipping_address->>'state' as state, count(*)::int as orders, sum(total)::bigint as revenue, count(distinct user_id)::int as customers
      from orders where ${VALID} and created_at between ${r.from} and ${r.to}
      group by 1 order by revenue desc`),
    rows<any>(sql`
      select shipping_address->>'city' as city, shipping_address->>'state' as state, count(*)::int as orders, sum(total)::bigint as revenue
      from orders where ${VALID} and created_at between ${r.from} and ${r.to}
      group by 1, 2 order by revenue desc limit 10`),
  ]);
  return { states: states.map((s) => ({ ...s, revenue: Number(s.revenue) })), cities: cities.map((c) => ({ ...c, revenue: Number(c.revenue) })) };
}

export async function traffic(q: { from?: string; to?: string; days?: number }) {
  const r = resolveRange(q);
  const [sources, devices, searches] = await Promise.all([
    rows<any>(sql`
      with s as (
        select session_id, coalesce(max(utm_source), 'direct') as source,
               bool_or(type = 'PURCHASE') as purchased,
               coalesce(sum(value) filter (where type = 'PURCHASE'), 0) as revenue
        from analytics_events where created_at between ${r.from} and ${r.to}
        group by session_id
      )
      select source, count(*)::int as sessions, count(*) filter (where purchased)::int as orders, sum(revenue)::bigint as revenue,
             round(count(*) filter (where purchased)::numeric * 100 / nullif(count(*), 0), 2) as conversion
      from s group by source order by sessions desc`),
    rows<any>(sql`
      select coalesce(device, 'unknown') as device, count(distinct session_id)::int as sessions,
             count(distinct session_id) filter (where type = 'PURCHASE')::int as orders
      from analytics_events where created_at between ${r.from} and ${r.to}
      group by 1 order by sessions desc`),
    rows<any>(sql`
      select lower(query) as term, count(*)::int as searches
      from analytics_events where type = 'SEARCH' and query is not null and created_at between ${r.from} and ${r.to}
      group by 1 order by searches desc limit 15`),
  ]);
  return {
    sources: sources.map((s) => ({ ...s, revenue: Number(s.revenue), conversion: Number(s.conversion ?? 0) })),
    devices,
    searches,
  };
}

export async function heatmap(q: { from?: string; to?: string; days?: number }) {
  const r = resolveRange({ days: 90, ...q });
  const data = await rows<{ dow: number; hour: number; orders: number; revenue: number }>(sql`
    select extract(dow from created_at at time zone ${TZ})::int as dow, extract(hour from created_at at time zone ${TZ})::int as hour,
           count(*)::int as orders, sum(total)::bigint as revenue
    from orders where ${VALID} and created_at between ${r.from} and ${r.to}
    group by 1, 2`);
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  data.forEach((d) => (grid[d.dow][d.hour] = d.orders));
  const peak = data.reduce((best, d) => (d.orders > (best?.orders ?? -1) ? d : best), data[0]);
  return { grid, peak: peak ? { dow: peak.dow, hour: peak.hour, orders: peak.orders } : null };
}

// ───────────── Payments, coupons, operations ─────────────

export async function payments(q: { from?: string; to?: string; days?: number }) {
  const r = resolveRange(q);
  const [methods, gateway, cancelReasons, fulfilment] = await Promise.all([
    rows<any>(sql`
      select payment_method as method, count(*)::int as orders, sum(total)::bigint as revenue,
             count(*) filter (where status = 'CANCELLED')::int as cancelled,
             count(*) filter (where status in ('RETURNED','REFUNDED'))::int as returned
      from orders where status not in ('PENDING_PAYMENT','FAILED') and created_at between ${r.from} and ${r.to}
      group by 1`),
    one<any>(sql`
      select count(*) filter (where status = 'PAID')::int as paid, count(*)::int as attempts,
             coalesce(jsonb_object_agg(method, n) filter (where method is not null), '{}') as instruments
      from (select status, method, count(*) over (partition by method) as n from payments where provider = 'razorpay' and amount > 0 and created_at between ${r.from} and ${r.to}) x`),
    rows<any>(sql`
      select coalesce(cancel_reason, 'Not specified') as reason, count(*)::int as orders
      from orders where status in ('CANCELLED','FAILED') and created_at between ${r.from} and ${r.to}
      group by 1 order by 2 desc limit 8`),
    one<any>(sql`
      select round(avg(extract(epoch from shipped_at - created_at) / 3600)::numeric, 1) as "hoursToShip",
             round(avg(extract(epoch from delivered_at - shipped_at) / 86400)::numeric, 1) as "daysInTransit",
             count(*) filter (where delivered_at <= expected_delivery_at)::int as "onTime",
             count(*) filter (where delivered_at is not null and expected_delivery_at is not null)::int as "withEta"
      from orders where shipped_at is not null and created_at between ${r.from} and ${r.to}`),
  ]);
  return {
    methods: methods.map((m) => ({ ...m, revenue: Number(m.revenue) })),
    gateway: { successRate: gateway.attempts ? Math.round((gateway.paid / gateway.attempts) * 1000) / 10 : 0, attempts: gateway.attempts, paid: gateway.paid, instruments: gateway.instruments },
    cancelReasons,
    fulfilment: { hoursToShip: Number(fulfilment.hoursToShip ?? 0), daysInTransit: Number(fulfilment.daysInTransit ?? 0), onTimeRate: fulfilment.withEta ? Math.round((fulfilment.onTime / fulfilment.withEta) * 1000) / 10 : null },
  };
}

export async function couponPerformance(q: { from?: string; to?: string; days?: number }) {
  const r = resolveRange(q);
  return rows<any>(sql`
    select c.code, c.type, c.value, c.is_active as "isActive", c.used_count as "usedCount",
           count(cr.id) filter (where cr.created_at between ${r.from} and ${r.to})::int as uses,
           coalesce(sum(cr.discount) filter (where cr.created_at between ${r.from} and ${r.to}), 0)::bigint as discount,
           coalesce(sum(o.total) filter (where cr.created_at between ${r.from} and ${r.to}), 0)::bigint as revenue
    from coupons c
    left join coupon_redemptions cr on cr.coupon_id = c.id
    left join orders o on o.id = cr.order_id and ${VALID_O}
    group by c.id order by revenue desc`).then((l) => l.map((x) => ({ ...x, discount: Number(x.discount), revenue: Number(x.revenue), roi: Number(x.discount) ? Math.round((Number(x.revenue) / Number(x.discount)) * 10) / 10 : null })));
}

export async function inventory() {
  const [summary, lowStock, deadStock] = await Promise.all([
    one<any>(sql`
      select count(*)::int as variants,
             count(*) filter (where stock = 0)::int as "outOfStock",
             count(*) filter (where stock > 0 and stock <= low_stock_threshold)::int as "lowStock",
             coalesce(sum(stock), 0)::int as units,
             coalesce(sum(stock * coalesce(cost_price, price * 0.6)), 0)::bigint as "stockValueCost",
             coalesce(sum(stock * price), 0)::bigint as "stockValueRetail"
      from product_variants where is_active`),
    rows<any>(sql`
      with velocity as (
        select oi.variant_id, sum(oi.quantity)::numeric / 30 as per_day
        from order_items oi join orders o on o.id = oi.order_id
        where ${VALID_O} and o.created_at > now() - interval '30 days'
        group by oi.variant_id
      )
      select v.id, p.name, p.slug, v.title, v.sku, v.stock, v.low_stock_threshold as threshold,
             round(coalesce(vel.per_day, 0), 2) as "dailySales",
             case when coalesce(vel.per_day, 0) > 0 then floor(v.stock / vel.per_day) end as "daysLeft",
             (select count(*) from stock_alerts sa where sa.variant_id = v.id and sa.notified_at is null)::int as waitlist
      from product_variants v join products p on p.id = v.product_id
      left join velocity vel on vel.variant_id = v.id
      where v.is_active and p.is_active and (v.stock <= v.low_stock_threshold or (vel.per_day > 0 and v.stock / vel.per_day < 14))
      order by "daysLeft" asc nulls last, v.stock asc
      limit 25`),
    rows<any>(sql`
      select p.id, p.name, p.slug, sum(v.stock)::int as stock, sum(v.stock * coalesce(v.cost_price, v.price * 0.6))::bigint as value
      from products p join product_variants v on v.product_id = p.id
      where p.is_active and not exists (
        select 1 from order_items oi join orders o on o.id = oi.order_id
        where oi.product_id = p.id and o.created_at > now() - interval '45 days' and ${VALID_O}
      )
      group by p.id having sum(v.stock) > 0 order by value desc limit 10`),
  ]);
  return {
    summary: { ...summary, stockValueCost: Number(summary.stockValueCost), stockValueRetail: Number(summary.stockValueRetail) },
    lowStock: lowStock.map((l) => ({ ...l, dailySales: Number(l.dailySales), daysLeft: l.daysLeft === null ? null : Number(l.daysLeft) })),
    deadStock: deadStock.map((d) => ({ ...d, value: Number(d.value) })),
  };
}

export async function abandonedCartStats() {
  const s = await one<any>(sql`
    with c as (
      select ca.id, ca.user_id, ca.last_activity_at, ca.reminder_count, ca.recovered_at,
             sum(ci.quantity * v.price) as value, sum(ci.quantity) as units
      from carts ca join cart_items ci on ci.cart_id = ca.id join product_variants v on v.id = ci.variant_id
      group by ca.id
    )
    select count(*) filter (where last_activity_at < now() - interval '1 hour')::int as abandoned,
           coalesce(sum(value) filter (where last_activity_at < now() - interval '1 hour'), 0)::bigint as value,
           count(*) filter (where reminder_count > 0)::int as reminded
    from c`);
  const recovered = await one<any>(sql`select count(*)::int as n from carts where recovered_at > now() - interval '30 days'`);
  const list = await rows<any>(sql`
    select ca.id, u.name, u.email, u.phone, ca.last_activity_at as "lastActivityAt", ca.reminder_count as "reminderCount",
           sum(ci.quantity)::int as items, sum(ci.quantity * v.price)::bigint as value
    from carts ca join users u on u.id = ca.user_id join cart_items ci on ci.cart_id = ca.id join product_variants v on v.id = ci.variant_id
    where ca.last_activity_at < now() - interval '1 hour'
    group by ca.id, u.id order by ca.last_activity_at desc limit 25`);
  return { abandoned: s.abandoned, value: Number(s.value), reminded: s.reminded, recovered30d: recovered.n, carts: list.map((l) => ({ ...l, value: Number(l.value) })) };
}

export async function notificationStats(q: { from?: string; to?: string; days?: number }) {
  const r = resolveRange(q);
  const [byChannel, byTemplate, wa] = await Promise.all([
    rows<any>(sql`
      select channel, count(*)::int as total, count(*) filter (where status = 'SENT')::int as sent,
             count(*) filter (where status = 'FAILED')::int as failed, count(*) filter (where status = 'SKIPPED')::int as skipped
      from notification_logs where created_at between ${r.from} and ${r.to} group by 1`),
    rows<any>(sql`
      select template, count(*)::int as total, count(*) filter (where status = 'FAILED')::int as failed
      from notification_logs where created_at between ${r.from} and ${r.to} group by 1 order by 2 desc`),
    one<any>(sql`
      select count(*) filter (where delivery_status in ('delivered','read'))::int as delivered,
             count(*) filter (where delivery_status = 'read')::int as read,
             count(*) filter (where status = 'SENT')::int as sent
      from notification_logs where channel = 'WHATSAPP' and created_at between ${r.from} and ${r.to}`),
  ]);
  return {
    byChannel,
    byTemplate,
    whatsapp: { ...wa, deliveryRate: wa.sent ? Math.round((wa.delivered / wa.sent) * 1000) / 10 : null, readRate: wa.sent ? Math.round((wa.read / wa.sent) * 1000) / 10 : null },
  };
}

/** Live view for the dashboard header. */
export async function realtime() {
  const [live, today, latest] = await Promise.all([
    one<any>(sql`
      select count(distinct session_id)::int as "activeSessions",
             count(distinct session_id) filter (where type in ('BEGIN_CHECKOUT','ADD_PAYMENT_INFO'))::int as "inCheckout"
      from analytics_events where created_at > now() - interval '5 minutes'`),
    one<any>(sql`
      select count(*) filter (where ${VALID})::int as orders, coalesce(sum(total) filter (where ${VALID}), 0)::bigint as revenue,
             count(*) filter (where status in ('CONFIRMED','PROCESSING','PACKED'))::int as "toShip"
      from orders where created_at >= date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ}`),
    rows<any>(sql`
      select o.id, o.order_number as "orderNumber", o.total, o.status, o.payment_method as "paymentMethod", o.created_at as "createdAt",
             u.name as customer, o.shipping_address->>'city' as city
      from orders o join users u on u.id = o.user_id order by o.created_at desc limit 8`),
  ]);
  const pending = await one<any>(sql`
    select count(*) filter (where status in ('CONFIRMED','PROCESSING','PACKED'))::int as "toShip",
           (select count(*) from return_requests where status = 'REQUESTED')::int as "returnRequests",
           (select count(*) from reviews where status = 'PENDING')::int as "pendingReviews",
           (select count(*) from questions where answer is null)::int as "unansweredQuestions",
           (select count(*) from product_variants where is_active and stock <= low_stock_threshold)::int as "lowStock"
    from orders`);
  return { ...live, today: { ...today, revenue: Number(today.revenue) }, latest: latest.map((l) => ({ ...l, total: Number(l.total) })), actionItems: pending };
}
