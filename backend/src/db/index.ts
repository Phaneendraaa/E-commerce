import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
});

export const db = drizzle(pool, { schema, logger: process.env.DB_LOG === 'true' });

export type DB = NodePgDatabase<typeof schema>;
/** Either the root db or a transaction handle. */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0] | DB;

export { schema };
