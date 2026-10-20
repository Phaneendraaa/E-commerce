/**
 * Deploy-time helper: seeds demo data only when SEED_DEMO_DATA=true AND the
 * database has no users yet, so redeploys never wipe real data.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { sql } from 'drizzle-orm';
import { db, pool } from './index';

async function main() {
  if (process.env.SEED_DEMO_DATA !== 'true') return console.log('SEED_DEMO_DATA is not "true" — skipping seed');
  const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from users`);
  if (rows[0].n > 0) return console.log(`Database already has ${rows[0].n} users — skipping seed`);
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
