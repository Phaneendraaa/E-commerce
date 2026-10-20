import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wrap async route handlers so rejected promises reach the error middleware. */
export const ah =
  <P = any, ResB = any, ReqB = any, Q = any>(
    fn: (req: Request<P, ResB, ReqB, Q>, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler<P, ResB, ReqB, Q> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export interface Paging {
  page: number;
  limit: number;
  skip: number;
}

export function paging(q: { page?: unknown; limit?: unknown }, defLimit = 20, maxLimit = 100): Paging {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(q.limit) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export const pageMeta = (p: Paging, total: number) => ({
  page: p.page,
  limit: p.limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / p.limit)),
});
