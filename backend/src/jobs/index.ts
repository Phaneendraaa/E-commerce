import cron from 'node-cron';
import { and, asc, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { db, pool, schema } from '../db';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { notify } from '../modules/notifications/notify';
import { scheduleReminder } from '../modules/notifications/reminders.service';
import { transitionOrder } from '../modules/orders/lifecycle';
import { PAYMENT_WINDOW_MIN } from '../modules/orders/orders.service';
import { getSettings } from '../modules/settings/settings.service';
import { normalizePhone, formatINR } from '../utils/format';
import { buildQuote } from '../modules/orders/pricing.service';

const { scheduledReminders, orders, orderItems, carts, cartItems, stockAlerts, productVariants, products, refreshTokens, otpCodes, reviews, users } = schema;

/**
 * Runs a job under a Postgres advisory lock so that, with several API replicas,
 * each job executes on only one of them at a time.
 */
async function locked(name: string, fn: () => Promise<void>) {
  const key = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>('select pg_try_advisory_lock($1) as ok', [key]);
    if (!rows[0]?.ok) return;
    try {
      await fn();
    } finally {
      await client.query('select pg_advisory_unlock($1)', [key]);
    }
  } catch (e) {
    logger.error(`Job ${name} failed`, e);
  } finally {
    client.release();
  }
}

const contact = (o: typeof orders.$inferSelect) => ({ phone: normalizePhone(o.shippingAddress.phone) });

// ───────────── Reminder queue ─────────────

export async function processReminders() {
  // Claim due reminders atomically (SKIP LOCKED makes this safe across replicas)
  const due = await db.execute<{ id: string }>(sql`
    update scheduled_reminders set attempts = attempts + 1
    where id in (
      select id from scheduled_reminders
      where status = 'PENDING' and run_at <= now()
      order by run_at asc
      limit 50
      for update skip locked
    )
    returning id`);
  if (!due.rows.length) return;

  const list = await db.query.scheduledReminders.findMany({ where: inArray(scheduledReminders.id, due.rows.map((r) => r.id)) });
  for (const r of list) {
    try {
      const outcome = await runReminder(r);
      await db
        .update(scheduledReminders)
        .set({ status: outcome === 'skip' ? 'CANCELLED' : 'SENT', sentAt: outcome === 'sent' ? new Date() : null })
        .where(eq(scheduledReminders.id, r.id));
    } catch (e) {
      const retry = r.attempts + 1 < 3;
      await db
        .update(scheduledReminders)
        .set({ status: retry ? 'PENDING' : 'FAILED', lastError: (e as Error).message, runAt: retry ? new Date(Date.now() + 10 * 60_000) : r.runAt })
        .where(eq(scheduledReminders.id, r.id));
    }
  }
  logger.info(`Processed ${list.length} reminder(s)`);
}

async function runReminder(r: typeof scheduledReminders.$inferSelect): Promise<'sent' | 'skip'> {
  const o = r.orderId ? await db.query.orders.findFirst({ where: eq(orders.id, r.orderId) }) : null;
  const base = o ? { orderNumber: o.orderNumber, total: o.total, paymentMethod: o.paymentMethod, carrier: o.carrier, trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl } : {};

  switch (r.type) {
    case 'PAYMENT_PENDING':
      if (!o || o.status !== 'PENDING_PAYMENT') return 'skip';
      await notify({ template: 'PAYMENT_PENDING', data: base, channels: ['WHATSAPP', 'EMAIL'], userId: o.userId, orderId: o.id, to: contact(o) });
      return 'sent';

    case 'TRACKING_REMINDER': {
      if (!o || !['SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.status) || !o.trackingNumber) return 'skip';
      await notify({ template: 'TRACKING_REMINDER', data: base, channels: ['WHATSAPP'], userId: o.userId, orderId: o.id, to: contact(o) });
      // Nudge again in 2 days while still in transit (max 3 nudges)
      const count = Number((r.payload as any)?.count ?? 1);
      if (count < 3) await scheduleReminder({ type: 'TRACKING_REMINDER', orderId: o.id, userId: o.userId, runAt: new Date(Date.now() + 48 * 3_600_000), payload: { count: count + 1 } });
      return 'sent';
    }

    case 'DELIVERY_FOLLOWUP':
      // Expected delivery date passed but still not delivered → share tracking again
      if (!o || !['SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.status)) return 'skip';
      await notify({ template: 'TRACKING_REMINDER', data: base, channels: ['WHATSAPP', 'SMS'], userId: o.userId, orderId: o.id, to: contact(o) });
      return 'sent';

    case 'REVIEW_REQUEST': {
      if (!o || o.status !== 'DELIVERED') return 'skip';
      const items = await db
        .select({ productId: orderItems.productId, name: orderItems.name, slug: products.slug })
        .from(orderItems)
        .innerJoin(products, eq(products.id, orderItems.productId))
        .where(eq(orderItems.orderId, o.id));
      for (const it of items) {
        const reviewed = await db.query.reviews.findFirst({ where: and(eq(reviews.productId, it.productId), eq(reviews.userId, o.userId)), columns: { id: true } });
        if (reviewed) continue;
        await notify({ template: 'REVIEW_REQUEST', data: { productName: it.name, productSlug: it.slug }, channels: ['WHATSAPP', 'EMAIL'], userId: o.userId, orderId: o.id, to: contact(o) });
        return 'sent';
      }
      return 'skip';
    }

    case 'ORDER_SHIPPED':
    case 'OUT_FOR_DELIVERY':
    case 'ORDER_CONFIRMED':
      if (!o) return 'skip';
      await notify({ template: r.type, data: base, channels: ['WHATSAPP'], userId: o.userId, orderId: o.id, to: contact(o) });
      return 'sent';

    default:
      return 'skip';
  }
}

// ───────────── Unpaid online orders ─────────────

export async function expireUnpaidOrders() {
  const stale = await db.query.orders.findMany({
    where: and(eq(orders.status, 'PENDING_PAYMENT'), lt(orders.createdAt, new Date(Date.now() - PAYMENT_WINDOW_MIN * 60_000))),
    columns: { id: true, orderNumber: true },
    limit: 100,
  });
  for (const o of stale) {
    await db.update(orders).set({ cancelReason: 'Payment not completed in time', cancelledAt: new Date() }).where(eq(orders.id, o.id));
    await transitionOrder(o.id, 'FAILED', { force: true, notify: false, note: `Auto-cancelled: payment not received within ${PAYMENT_WINDOW_MIN} minutes` });
  }
  if (stale.length) logger.info(`Expired ${stale.length} unpaid order(s)`);
}

// ───────────── Abandoned carts ─────────────

export async function abandonedCarts() {
  const s = await getSettings();
  const cutoff = new Date(Date.now() - env.ABANDONED_CART_HOURS * 3_600_000);
  const list = await db.query.carts.findMany({
    where: and(
      lt(carts.lastActivityAt, cutoff),
      lt(carts.reminderCount, 2),
      or(isNull(carts.lastReminderAt), lt(carts.lastReminderAt, new Date(Date.now() - 22 * 3_600_000))),
      sql`exists (select 1 from cart_items ci where ci.cart_id = "carts"."id")`,
      gt(carts.lastActivityAt, new Date(Date.now() - 7 * 86_400_000)),
    ),
    limit: 50,
  });

  for (const c of list) {
    const items = await db.query.cartItems.findMany({ where: eq(cartItems.cartId, c.id), columns: { variantId: true, quantity: true } });
    const q = await buildQuote(items, { userId: c.userId, settings: s });
    const live = q.lines.filter((l) => l.available);
    if (!live.length) continue;
    const second = c.reminderCount >= 1;
    await notify({
      template: 'ABANDONED_CART',
      data: {
        itemCount: q.itemCount,
        total: q.subtotal,
        items: live.slice(0, 4).map((l) => ({ name: l.productName, variantTitle: l.variantTitle, quantity: l.quantity, total: l.total })),
        coupon: second ? 'FLAT200' : undefined,
      },
      channels: second ? ['EMAIL', 'WHATSAPP'] : ['EMAIL', 'WHATSAPP'],
      userId: c.userId,
    });
    await db.update(carts).set({ reminderCount: c.reminderCount + 1, lastReminderAt: new Date() }).where(eq(carts.id, c.id));
  }
  if (list.length) logger.info(`Sent ${list.length} abandoned-cart reminder(s)`);
}

// ───────────── Back in stock ─────────────

export async function backInStock() {
  const rows = await db
    .select({ alert: stockAlerts, productName: products.name, productSlug: products.slug })
    .from(stockAlerts)
    .innerJoin(productVariants, eq(productVariants.id, stockAlerts.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(isNull(stockAlerts.notifiedAt), gt(productVariants.stock, 0), eq(productVariants.isActive, true)))
    .limit(100);
  for (const r of rows) {
    await notify({
      template: 'BACK_IN_STOCK',
      data: { productName: r.productName, productSlug: r.productSlug },
      channels: ['EMAIL', 'WHATSAPP'],
      userId: r.alert.userId,
      to: { email: r.alert.email, phone: r.alert.phone },
    });
    await db.update(stockAlerts).set({ notifiedAt: new Date() }).where(eq(stockAlerts.id, r.alert.id));
  }
}

// ───────────── Daily housekeeping & digest ─────────────

export async function cleanup() {
  await db.delete(refreshTokens).where(or(lt(refreshTokens.expiresAt, new Date()), lt(refreshTokens.revokedAt, new Date(Date.now() - 7 * 86_400_000))));
  await db.delete(otpCodes).where(lt(otpCodes.expiresAt, new Date(Date.now() - 86_400_000)));
}

export async function adminDigest() {
  const since = new Date(Date.now() - 86_400_000);
  const [stats] = await db
    .select({ orders: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int` })
    .from(orders)
    .where(and(gt(orders.createdAt, since), sql`${orders.status} not in ('CANCELLED','FAILED','PENDING_PAYMENT')`));
  const low = await db
    .select({ name: products.name, title: productVariants.title, stock: productVariants.stock })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.isActive, true), lte(productVariants.stock, productVariants.lowStockThreshold)))
    .orderBy(asc(productVariants.stock))
    .limit(15);
  const toShip = await db.$count(orders, inArray(orders.status, ['CONFIRMED', 'PROCESSING', 'PACKED']));
  const admins = await db.query.users.findMany({ where: inArray(users.role, ['ADMIN', 'MANAGER']), columns: { id: true, email: true } });

  const message = `Last 24h: ${stats.orders} orders, ${formatINR(stats.revenue)} revenue. ${toShip} orders waiting to ship.<br/><br/><b>Low stock</b><br/>${low.map((l) => `${l.name} (${l.title}): ${l.stock}`).join('<br/>') || 'All good 👍'}`;
  for (const a of admins) {
    if (a.email) await notify({ template: 'CUSTOM', data: { subject: `Daily store digest — ${stats.orders} orders`, message }, channels: ['EMAIL'], to: { email: a.email } });
  }
}

// ───────────── Scheduler ─────────────

export function startJobs() {
  if (!env.ENABLE_JOBS || env.isTest) return;
  const tz = { timezone: 'Asia/Kolkata' };
  cron.schedule('* * * * *', () => locked('reminders', processReminders), tz);
  cron.schedule('*/5 * * * *', () => locked('expire-unpaid', expireUnpaidOrders), tz);
  cron.schedule('*/15 * * * *', () => locked('abandoned-carts', abandonedCarts), tz);
  cron.schedule('*/10 * * * *', () => locked('back-in-stock', backInStock), tz);
  cron.schedule('30 3 * * *', () => locked('cleanup', cleanup), tz);
  cron.schedule('0 9 * * *', () => locked('admin-digest', adminDigest), tz);
  logger.info('⏰ Background jobs scheduled');
}

// ───────────── Serverless mode (Vercel) ─────────────
// No long-running process means no node-cron. Instead, due jobs are run
// (a) opportunistically after API requests, at most once a minute per instance,
// and (b) by Vercel Cron / any external cron hitting /api/cron/frequent.
// Last-run times live in the settings table so all instances share them.

const INTERVAL_MIN: Record<string, number> = { reminders: 1, 'expire-unpaid': 5, 'back-in-stock': 10, 'abandoned-carts': 15 };
const FREQUENT: Record<string, () => Promise<void>> = {
  reminders: processReminders,
  'expire-unpaid': expireUnpaidOrders,
  'back-in-stock': backInStock,
  'abandoned-carts': abandonedCarts,
};

export async function runDueJobs(force = false) {
  const ran: string[] = [];
  await locked('due-jobs', async () => {
    const row = await db.query.settings.findFirst({ where: (t, { eq: e }) => e(t.key, 'jobs_last_run') });
    const last = ((row?.value as Record<string, number>) ?? {}) as Record<string, number>;
    const now = Date.now();
    for (const [name, fn] of Object.entries(FREQUENT)) {
      if (!force && now - (last[name] ?? 0) < INTERVAL_MIN[name] * 60_000 - 5_000) continue;
      try {
        await fn();
      } catch (e) {
        logger.error(`Job ${name} failed`, e);
      }
      last[name] = Date.now();
      ran.push(name);
    }
    await db
      .insert(schema.settings)
      .values({ key: 'jobs_last_run', value: last })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: last } });
  });
  return ran;
}

export async function runDailyJobs() {
  await locked('cleanup', cleanup);
  await locked('admin-digest', adminDigest);
}

/** Manually trigger a job (admin panel "Run now"). */
export const jobs = {
  reminders: processReminders,
  'expire-unpaid': expireUnpaidOrders,
  'abandoned-carts': abandonedCarts,
  'back-in-stock': backInStock,
  cleanup,
  'admin-digest': adminDigest,
} as const;
