import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../db/schema';
import { verifyAccessToken } from '../lib/tokens';
import { forbidden, unauthorized } from '../utils/errors';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return (req.cookies?.access_token as string | undefined) ?? null;
}

/** Attaches req.user when a valid token is present; never fails. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) req.user = { id: payload.sub, role: payload.role };
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(unauthorized());
  const payload = verifyAccessToken(token);
  if (!payload) return next(unauthorized('Session expired, please sign in again'));
  req.user = { id: payload.sub, role: payload.role };
  next();
}

const rank: Record<Role, number> = { CUSTOMER: 0, SUPPORT: 1, MANAGER: 2, ADMIN: 3 };

/** Requires the user to have at least the given role (ADMIN > MANAGER > SUPPORT > CUSTOMER). */
export const requireRole =
  (min: Role) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (rank[req.user.role] < rank[min]) return next(forbidden());
    next();
  };

/** Shorthand for admin panel access (any staff role). */
export const requireStaff = [requireAuth, requireRole('SUPPORT')];
