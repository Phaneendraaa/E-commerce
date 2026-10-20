import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}

function send(res: Response, status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) return send(res, err.statusCode, err.code, err.message, err.details);

  // Postgres errors (drizzle may wrap them in `cause`)
  const e = err as any;
  const pg = (e?.code && typeof e.code === 'string' && /^\d|^[0-9A-Z]{5}$/.test(e.code) ? e : e?.cause) as
    | { code?: string; detail?: string }
    | undefined;
  if (pg?.code === '23505') {
    const field = /Key \(([^)]+)\)/.exec(pg.detail ?? '')?.[1] ?? 'value';
    return send(res, 409, 'CONFLICT', `A record with this ${field} already exists`);
  }
  if (pg?.code === '23503') return send(res, 409, 'CONFLICT', 'This record is referenced by other data');
  if (pg?.code === '22P02') return send(res, 400, 'BAD_REQUEST', 'Invalid identifier');

  if (e?.type === 'entity.parse.failed') return send(res, 400, 'BAD_REQUEST', 'Malformed JSON body');
  if (typeof e?.message === 'string' && e.message.includes('not allowed by CORS')) return send(res, 403, 'FORBIDDEN', e.message);

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
  send(res, 500, 'INTERNAL', 'Something went wrong on our side', env.isProd ? undefined : { debug: e?.message });
}
