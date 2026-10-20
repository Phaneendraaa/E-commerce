import { waitUntil } from '@vercel/functions';
import { logger } from './logger';

/**
 * Run work after the response is sent. On a long-running server it simply
 * runs; on serverless (Vercel) it keeps the function alive until it finishes.
 */
export function background(work: Promise<unknown> | (() => Promise<unknown>)) {
  const p = (typeof work === 'function' ? work() : work).catch((e) => logger.error('Background task failed', e));
  if (process.env.VERCEL) waitUntil(p);
}
