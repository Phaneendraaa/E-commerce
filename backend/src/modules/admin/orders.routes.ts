import { Router } from 'express';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { ah, pageMeta, paging } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { badRequest, notFound } from '../../utils/errors';
import { normalizePhone } from '../../utils/format';
import { TRANSITIONS, transitionOrder } from '../orders/lifecycle';
import { streamInvoice } from '../orders/invoice';
import { getSettings } from '../settings/settings.service';
import { notify, sendManualWhatsApp } from '../notifications/notify';
import type { TemplateKey } from '../notifications/templates';
import { audit, rupees, sendCsv } from './helpers';

const { orders, users, orderStatusHistory, notificationLogs, scheduledReminders, returnRequests } = schema;
export const adminOrdersRouter = Router();

const listQuery = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  paymentMethod: z.enum(['RAZORPAY', 'COD']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'total_desc', 'total_asc']).default('newest'),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(200).default(20),
});

function filters(q: z.infer<typeof listQuery>) {
  const conds: SQL[] = [];
  if (q.q) {
    const like = `%${q.q.trim()}%`;
    conds.push(or(ilike(orders.orderNumber, like), ilike(users.name, like), ilike(users.email, like), ilike(users.phone, like), sql`${orders.shippingAddress}->>'phone' ilike ${like}`, ilike(orders.trackingNumber, like))!);
  }
  if (q.status) conds.push(inArray(orders.status, q.status.split(',') as any));
  if (q.paymentStatus) conds.push(inArray(orders.paymentStatus, q.paymentStatus.split(',') as any));
  if (q.paymentMethod) conds.push(eq(orders.paymentMethod, q.paymentMethod));
  if (q.from) conds.push(gte(orders.createdAt, new Date(q.from)));
  if (q.to) conds.push(lte(orders.createdAt, new Date(new Date(q.to).getTime() + 86_399_999)));
  return conds.length ? and(...conds) : undefined;
}

adminOrdersRouter.get(
  '/',
  validate({ query: listQuery }),
  ah(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const p = paging(q);
    const where = filters(q);
    const order = { newest: desc(orders.createdAt), oldest: asc(orders.createdAt), total_desc: desc(orders.total), total_asc: asc(orders.total) }[q.sort];
    const [items, [{ total }], counts] = await Promise.all([
      db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          paymentMethod: orders.paymentMethod,
          total: orders.total,
          createdAt: orders.createdAt,
          carrier: orders.carrier,
          trackingNumber: orders.trackingNumber,
          city: sql<string>`${orders.shippingAddress}->>'city'`,
          customer: { id: users.id, name: users.name, email: users.email, phone: users.phone },
          itemCount: sql<number>`(select coalesce(sum(quantity), 0)::int from order_items oi where oi.order_id = "orders"."id")`,
        })
        .from(orders)
        .innerJoin(users, eq(users.id, orders.userId))
        .where(where)
        .orderBy(order, desc(orders.id))
        .limit(p.limit)
        .offset(p.skip),
      db.select({ total: sql<number>`count(*)::int` }).from(orders).innerJoin(users, eq(users.id, orders.userId)).where(where),
      db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    ]);
    res.json({ items, statusCounts: Object.fromEntries(counts.map((c) => [c.status, c.n])), ...pageMeta(p, total) });
  }),
);

adminOrdersRouter.get(
  '/export',
  validate({ query: listQuery }),
  ah(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const list = await db
      .select({ o: orders, name: users.name, email: users.email })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .where(filters(q))
      .orderBy(desc(orders.createdAt))
      .limit(20000);
    sendCsv(
      res,
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
      list.map(({ o, name, email }) => ({
        order_number: o.orderNumber,
        date: o.createdAt,
        customer: name,
        email,
        phone: o.shippingAddress.phone,
        city: o.shippingAddress.city,
        state: o.shippingAddress.state,
        pincode: o.shippingAddress.pincode,
        status: o.status,
        payment_method: o.paymentMethod,
        payment_status: o.paymentStatus,
        subtotal: rupees(o.subtotal),
        discount: rupees(o.discount + o.loyaltyDiscount),
        shipping: rupees(o.shippingFee + o.codFee),
        tax: rupees(o.tax),
        total: rupees(o.total),
        coupon: o.couponCode,
        carrier: o.carrier,
        tracking_number: o.trackingNumber,
        utm_source: o.utmSource,
      })),
    );
  }),
);

adminOrdersRouter.get(
  '/:id',
  ah(async (req, res) => {
    const o = await db.query.orders.findFirst({
      where: /^[0-9a-f-]{36}$/i.test(req.params.id) ? eq(orders.id, req.params.id) : eq(orders.orderNumber, req.params.id),
      with: {
        items: true,
        history: { orderBy: asc(orderStatusHistory.createdAt) },
        payments: true,
        returns: true,
        user: { columns: { id: true, name: true, email: true, phone: true, createdAt: true, loyaltyPoints: true, whatsappOptIn: true } },
        notifications: { orderBy: desc(notificationLogs.createdAt) },
      },
    });
    if (!o) throw notFound('Order');
    const [reminders, customerStats] = await Promise.all([
      db.query.scheduledReminders.findMany({ where: eq(scheduledReminders.orderId, o.id), orderBy: asc(scheduledReminders.runAt) }),
      db
        .select({ orders: sql<number>`count(*)::int`, spent: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} not in ('CANCELLED','FAILED','PENDING_PAYMENT')), 0)::int` })
        .from(orders)
        .where(eq(orders.userId, o.userId)),
    ]);
    const profit = o.items.reduce((s, i) => s + i.total - (i.costPrice ?? Math.round(i.price * 0.6)) * i.quantity, 0) - o.discount - o.loyaltyDiscount;
    res.json({ order: { ...o, reminders, customerStats: customerStats[0], profit, allowedTransitions: TRANSITIONS[o.status] } });
  }),
);

adminOrdersRouter.post(
  '/:id/status',
  validate({
    body: z.object({
      status: z.enum(schema.orderStatusEnum.enumValues),
      note: z.string().max(500).optional(),
      carrier: z.string().trim().max(60).optional(),
      trackingNumber: z.string().trim().max(80).optional(),
      trackingUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
      expectedDeliveryAt: z.coerce.date().optional(),
      notifyCustomer: z.boolean().default(true),
      cancelReason: z.string().max(300).optional(),
    }),
  }),
  ah(async (req, res) => {
    const b = req.body;
    if (b.status === 'CANCELLED') await db.update(orders).set({ cancelReason: b.cancelReason ?? b.note ?? 'Cancelled by store', cancelledAt: new Date() }).where(eq(orders.id, req.params.id));
    const updated = await transitionOrder(req.params.id, b.status, {
      note: b.note,
      actorId: req.user!.id,
      carrier: b.carrier,
      trackingNumber: b.trackingNumber,
      trackingUrl: b.trackingUrl || undefined,
      expectedDeliveryAt: b.expectedDeliveryAt,
      notify: b.notifyCustomer,
    });
    await audit(req, 'status_change', 'order', updated.id, { to: b.status });
    res.json({ order: updated });
  }),
);

/** Update courier / tracking details without changing status (e.g. corrected AWB). */
adminOrdersRouter.patch(
  '/:id/tracking',
  validate({ body: z.object({ carrier: z.string().trim().max(60), trackingNumber: z.string().trim().max(80), trackingUrl: z.string().url().max(500).optional().or(z.literal('')), expectedDeliveryAt: z.coerce.date().optional(), resend: z.boolean().default(false) }) }),
  ah(async (req, res) => {
    const [o] = await db
      .update(orders)
      .set({ carrier: req.body.carrier, trackingNumber: req.body.trackingNumber, trackingUrl: req.body.trackingUrl || null, expectedDeliveryAt: req.body.expectedDeliveryAt })
      .where(eq(orders.id, req.params.id))
      .returning();
    if (!o) throw notFound('Order');
    await db.insert(orderStatusHistory).values({ orderId: o.id, status: o.status, note: `Tracking updated: ${o.carrier} ${o.trackingNumber}`, createdById: req.user!.id });
    if (req.body.resend) {
      await notify({ template: 'ORDER_SHIPPED', data: { orderNumber: o.orderNumber, carrier: o.carrier, trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl, expectedDeliveryAt: o.expectedDeliveryAt }, channels: ['WHATSAPP', 'SMS'], userId: o.userId, orderId: o.id, to: { phone: normalizePhone(o.shippingAddress.phone) } });
    }
    await audit(req, 'update_tracking', 'order', o.id);
    res.json({ order: o });
  }),
);

/** Send a notification about this order — a template reminder or a free-form WhatsApp. */
adminOrdersRouter.post(
  '/:id/notify',
  validate({
    body: z.object({
      template: z.enum(['ORDER_CONFIRMED', 'ORDER_SHIPPED', 'TRACKING_REMINDER', 'OUT_FOR_DELIVERY', 'ORDER_DELIVERED', 'PAYMENT_PENDING', 'REVIEW_REQUEST', 'CUSTOM']),
      channels: z.array(z.enum(['EMAIL', 'SMS', 'WHATSAPP'])).min(1),
      message: z.string().max(1000).optional(),
    }),
  }),
  ah(async (req, res) => {
    const o = await db.query.orders.findFirst({ where: eq(orders.id, req.params.id), with: { items: { limit: 1 } } });
    if (!o) throw notFound('Order');
    if (req.body.template === 'CUSTOM' && !req.body.message) throw badRequest('Message is required');
    const phone = normalizePhone(o.shippingAddress.phone);

    // Free-form WhatsApp (works inside the 24h service window)
    if (req.body.template === 'CUSTOM' && req.body.channels.length === 1 && req.body.channels[0] === 'WHATSAPP' && phone) {
      const r = await sendManualWhatsApp({ phone, text: req.body.message, userId: o.userId, orderId: o.id });
      return void res.json({ results: [{ channel: 'WHATSAPP', status: !r.ok ? 'FAILED' : r.skipped ? 'SKIPPED' : 'SENT', error: r.error }] });
    }

    const product = o.items[0] ? await db.query.products.findFirst({ where: eq(schema.products.id, o.items[0].productId), columns: { name: true, slug: true } }) : null;
    const results = await notify({
      template: req.body.template as TemplateKey,
      data: {
        orderNumber: o.orderNumber,
        total: o.total,
        paymentMethod: o.paymentMethod,
        carrier: o.carrier,
        trackingNumber: o.trackingNumber,
        trackingUrl: o.trackingUrl,
        expectedDeliveryAt: o.expectedDeliveryAt,
        productName: product?.name,
        productSlug: product?.slug,
        subject: `Update on your order ${o.orderNumber}`,
        message: req.body.message,
      },
      channels: req.body.channels,
      userId: o.userId,
      orderId: o.id,
      to: { phone },
    });
    await audit(req, 'notify', 'order', o.id, { template: req.body.template, channels: req.body.channels });
    res.json({ results });
  }),
);

adminOrdersRouter.post(
  '/:id/note',
  validate({ body: z.object({ note: z.string().trim().min(1).max(1000) }) }),
  ah(async (req, res) => {
    const o = await db.query.orders.findFirst({ where: eq(orders.id, req.params.id), columns: { id: true, status: true } });
    if (!o) throw notFound('Order');
    const [h] = await db.insert(orderStatusHistory).values({ orderId: o.id, status: o.status, note: `📝 ${req.body.note}`, createdById: req.user!.id }).returning();
    res.status(201).json({ entry: h });
  }),
);

adminOrdersRouter.post(
  '/bulk-status',
  validate({ body: z.object({ ids: z.array(z.string().uuid()).min(1).max(200), status: z.enum(['PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED']), notifyCustomer: z.boolean().default(true) }) }),
  ah(async (req, res) => {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of req.body.ids) {
      try {
        await transitionOrder(id, req.body.status, { actorId: req.user!.id, notify: req.body.notifyCustomer });
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, ok: false, error: (e as Error).message });
      }
    }
    await audit(req, 'bulk_status', 'order', null, { status: req.body.status, count: req.body.ids.length });
    res.json({ results, updated: results.filter((r) => r.ok).length });
  }),
);

adminOrdersRouter.get(
  '/:id/invoice',
  ah(async (req, res) => {
    const o = await db.query.orders.findFirst({ where: eq(orders.id, req.params.id), with: { items: true, user: { columns: { name: true, email: true } } } });
    if (!o) throw notFound('Order');
    streamInvoice(res, o, await getSettings(), o.user);
  }),
);

// ───────────── Returns ─────────────

adminOrdersRouter.get(
  '/returns/list',
  validate({ query: z.object({ status: z.string().optional() }) }),
  ah(async (req, res) => {
    const list = await db.query.returnRequests.findMany({
      where: req.query.status ? inArray(returnRequests.status, String(req.query.status).split(',') as any) : undefined,
      orderBy: desc(returnRequests.createdAt),
      limit: 200,
      with: { order: { columns: { id: true, orderNumber: true, total: true, paymentMethod: true }, with: { items: true } }, user: { columns: { name: true, email: true, phone: true } } },
    });
    res.json({ returns: list });
  }),
);

adminOrdersRouter.post(
  '/returns/:id',
  validate({ body: z.object({ status: z.enum(['APPROVED', 'REJECTED', 'PICKED_UP', 'REFUNDED']), adminNote: z.string().max(500).optional(), refundAmount: z.number().int().min(0).optional() }) }),
  ah(async (req, res) => {
    const r = await db.query.returnRequests.findFirst({ where: eq(returnRequests.id, req.params.id), with: { order: true } });
    if (!r) throw notFound('Return request');
    const [updated] = await db
      .update(returnRequests)
      .set({ status: req.body.status, adminNote: req.body.adminNote, refundAmount: req.body.refundAmount ?? r.refundAmount })
      .where(eq(returnRequests.id, r.id))
      .returning();

    if (req.body.status === 'REJECTED' && r.order.status === 'RETURN_REQUESTED') await transitionOrder(r.orderId, 'DELIVERED', { note: `Return rejected: ${req.body.adminNote ?? ''}`, actorId: req.user!.id, notify: false });
    if (req.body.status === 'PICKED_UP' && r.order.status === 'RETURN_REQUESTED') await transitionOrder(r.orderId, 'RETURNED', { note: 'Return picked up', actorId: req.user!.id, notify: false });
    if (req.body.status === 'REFUNDED') {
      const cur = await db.query.orders.findFirst({ where: eq(orders.id, r.orderId), columns: { status: true } });
      if (cur?.status === 'RETURN_REQUESTED') await transitionOrder(r.orderId, 'RETURNED', { actorId: req.user!.id, notify: false });
      await transitionOrder(r.orderId, 'REFUNDED', { note: 'Refund processed for return', actorId: req.user!.id });
    } else {
      await notify({ template: 'RETURN_UPDATE', data: { orderNumber: r.order.orderNumber, status: req.body.status, note: req.body.adminNote }, channels: ['EMAIL', 'WHATSAPP'], userId: r.userId, orderId: r.orderId, to: { phone: normalizePhone(r.order.shippingAddress.phone) } });
    }
    await audit(req, 'return_update', 'return', r.id, { status: req.body.status });
    res.json({ return: updated });
  }),
);
