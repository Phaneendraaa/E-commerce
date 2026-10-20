import { and, eq, inArray } from 'drizzle-orm';
import { db, schema, type Tx } from '../../db';
import type { ReminderType } from '../../db/schema';

const { scheduledReminders } = schema;

/**
 * Durable reminder queue backed by Postgres. Reminders survive restarts and are
 * processed by the jobs runner (jobs/index.ts) every minute.
 */
export async function scheduleReminder(
  opts: { type: ReminderType; runAt: Date; orderId?: string | null; userId?: string | null; payload?: Record<string, unknown> },
  tx: Tx = db,
) {
  // De-duplicate: one pending reminder per (type, order)
  if (opts.orderId) {
    await tx
      .update(scheduledReminders)
      .set({ status: 'CANCELLED' })
      .where(and(eq(scheduledReminders.orderId, opts.orderId), eq(scheduledReminders.type, opts.type), eq(scheduledReminders.status, 'PENDING')));
  }
  const [r] = await tx
    .insert(scheduledReminders)
    .values({ type: opts.type, runAt: opts.runAt, orderId: opts.orderId ?? null, userId: opts.userId ?? null, payload: opts.payload ?? null })
    .returning();
  return r;
}

export async function cancelReminders(orderId: string, types?: ReminderType[], tx: Tx = db) {
  await tx
    .update(scheduledReminders)
    .set({ status: 'CANCELLED' })
    .where(and(eq(scheduledReminders.orderId, orderId), eq(scheduledReminders.status, 'PENDING'), types ? inArray(scheduledReminders.type, types) : undefined));
}
