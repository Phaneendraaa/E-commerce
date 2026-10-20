/* Applies pending SQL migrations from ./drizzle. Run with `npm run db:migrate`. */
import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';

async function run() {
  const folder = path.resolve(__dirname, '../../drizzle');
  console.log(`Applying migrations from ${folder}…`);
  await migrate(db, { migrationsFolder: folder });
  console.log('✅ Migrations applied');
  await pool.end();
}

run().catch(async (e) => {
  console.error('❌ Migration failed', e);
  await pool.end();
  process.exit(1);
});
