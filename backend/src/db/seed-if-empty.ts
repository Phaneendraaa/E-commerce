/**
 * Deploy-time helper: seeds demo data only when SEED_DEMO_DATA=true AND the
 * database has no users yet, so redeploys never wipe real data.
 * One-off override: SEED_RESET=true wipes and reseeds (remove it afterwards).
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { sql } from 'drizzle-orm';
import { db, pool } from './index';

/** One-off: STORE_NAME_SET=<name> renames the store in the DB on deploy (unset it afterwards). */
async function applyStoreName() {
  const name = process.env.STORE_NAME_SET?.trim();
  if (!name) return;
  await db.execute(sql`update settings set value = jsonb_set(value::jsonb, '{storeName}', to_jsonb(${name}::text)), updated_at = now() where key = 'store'`);
  console.log(`Store name set to "${name}"`);
}

async function main() {
  await applyStoreName();
  if (process.env.SEED_DEMO_DATA !== 'true') return console.log('SEED_DEMO_DATA is not "true" — skipping seed');
  const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from users`);
  const reset = process.env.SEED_RESET === 'true';
  if (reset) console.log('SEED_RESET=true — wiping demo data and reseeding (unset this after the deploy)');
  if (rows[0].n > 0 && !reset) return console.log(`Database already has ${rows[0].n} users — skipping seed`);
  await pool.end();
  const r = spawnSync(process.execPath, [require.resolve('tsx/cli'), path.join(__dirname, 'seed.ts')], { stdio: 'inherit' });
  process.exitCode = r.status ?? 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => undefined));
