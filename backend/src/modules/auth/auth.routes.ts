import { Router, type CookieOptions, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db';
import { env } from '../../config/env';
import { ah } from '../../utils/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { authLimiter, otpLimiter } from '../../middleware/rateLimit';
import { unauthorized } from '../../utils/errors';
import * as auth from './auth.service';

export const authRouter = Router();

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';

const baseCookie: CookieOptions = { httpOnly: true, secure: env.isProd, sameSite: 'lax' };

function setSessionCookies(res: Response, s: { accessToken: string; refreshToken: string; refreshExpiresAt: Date }) {
  res.cookie(ACCESS_COOKIE, s.accessToken, { ...baseCookie, path: '/', maxAge: 15 * 60_000 });
  res.cookie(REFRESH_COOKIE, s.refreshToken, { ...baseCookie, path: '/api/auth', expires: s.refreshExpiresAt });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: '/api/auth' });
}

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') });

async function respondWithSession(req: Request, res: Response, user: typeof schema.users.$inferSelect, extra: object = {}) {
  const session = await auth.issueSession(user, meta(req));
  setSessionCookies(res, session);
  res.json({ user: auth.toPublicUser(user), accessToken: session.accessToken, ...extra });
}

const password = z.string().min(8, 'Password must be at least 8 characters').max(128);

authRouter.post(
  '/register',
  authLimiter,
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email(),
      phone: z.string().trim().optional(),
      password,
      referralCode: z.string().trim().max(20).optional(),
    }),
  }),
  ah(async (req, res) => {
    const user = await auth.register(req.body);
    await respondWithSession(req, res, user, { isNew: true });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate({ body: z.object({ identifier: z.string().trim().min(3), password: z.string().min(1) }) }),
  ah(async (req, res) => {
    const user = await auth.login(req.body.identifier, req.body.password);
    await respondWithSession(req, res, user);
  }),
);

authRouter.post(
  '/otp/send',
  otpLimiter,
  validate({
    body: z.object({
      target: z.string().trim().min(5),
      channel: z.enum(['SMS', 'WHATSAPP', 'EMAIL']).default('SMS'),
    }),
  }),
  ah(async (req, res) => {
    const r = await auth.sendOtp(req.body.target, 'LOGIN', req.body.channel);
    const exists = await db.query.users.findFirst({
      where: r.target.includes('@') ? eq(schema.users.email, r.target) : eq(schema.users.phone, r.target),
      columns: { id: true },
    });
    res.json({ sent: true, channel: r.channel, isNewUser: !exists, ...(r.devCode ? { devCode: r.devCode } : {}) });
  }),
);

authRouter.post(
  '/otp/verify',
  authLimiter,
  validate({
    body: z.object({
      target: z.string().trim().min(5),
      code: z.string().trim().length(6),
      name: z.string().trim().min(2).max(80).optional(),
      referralCode: z.string().trim().max(20).optional(),
    }),
  }),
  ah(async (req, res) => {
    const { user, isNew } = await auth.loginWithOtp(req.body);
    await respondWithSession(req, res, user, { isNew });
  }),
);

authRouter.post(
  '/google',
  authLimiter,
  validate({ body: z.object({ credential: z.string().min(10), referralCode: z.string().optional() }) }),
  ah(async (req, res) => {
    const user = await auth.loginWithGoogle(req.body.credential, req.body.referralCode);
    await respondWithSession(req, res, user);
  }),
);

authRouter.post(
  '/refresh',
  ah(async (req, res) => {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
    if (!token) throw unauthorized('No session');
    try {
      const r = await auth.rotateRefreshToken(token, meta(req));
      setSessionCookies(res, r);
      res.json({ user: auth.toPublicUser(r.user), accessToken: r.accessToken });
    } catch (e) {
      clearSessionCookies(res);
      throw e;
    }
  }),
);

authRouter.post(
  '/logout',
  ah(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) await auth.revokeRefreshToken(token);
    clearSessionCookies(res);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/logout-all',
  requireAuth,
  ah(async (req, res) => {
    await auth.revokeAllSessions(req.user!.id);
    clearSessionCookies(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, req.user!.id) });
    if (!u) throw unauthorized();
    res.json({ user: auth.toPublicUser(u) });
  }),
);

authRouter.post(
  '/password/forgot',
  otpLimiter,
  validate({ body: z.object({ email: z.string().trim().email() }) }),
  ah(async (req, res) => {
    const r = await auth.forgotPassword(req.body.email);
    res.json({ sent: true, message: 'If an account exists, a reset code has been sent.', ...(r.devCode ? { devCode: r.devCode } : {}) });
  }),
);

authRouter.post(
  '/password/reset',
  authLimiter,
  validate({ body: z.object({ email: z.string().trim().email(), code: z.string().length(6), password }) }),
  ah(async (req, res) => {
    const user = await auth.resetPassword(req.body.email, req.body.code, req.body.password);
    await respondWithSession(req, res, user);
  }),
);

authRouter.post(
  '/password/change',
  requireAuth,
  validate({ body: z.object({ currentPassword: z.string().optional(), newPassword: password }) }),
  ah(async (req, res) => {
    await auth.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    res.json({ ok: true });
  }),
);

/** Verify a phone number added to the profile. */
authRouter.post(
  '/verify-phone/send',
  requireAuth,
  otpLimiter,
  validate({ body: z.object({ phone: z.string().trim(), channel: z.enum(['SMS', 'WHATSAPP']).default('SMS') }) }),
  ah(async (req, res) => {
    const r = await auth.sendOtp(req.body.phone, 'VERIFY_PHONE', req.body.channel);
    res.json({ sent: true, ...(r.devCode ? { devCode: r.devCode } : {}) });
  }),
);

authRouter.post(
  '/verify-phone/confirm',
  requireAuth,
  validate({ body: z.object({ phone: z.string().trim(), code: z.string().length(6) }) }),
  ah(async (req, res) => {
    const phone = await auth.verifyOtp(req.body.phone, req.body.code, 'VERIFY_PHONE');
    const [u] = await db.update(schema.users).set({ phone, phoneVerified: true }).where(eq(schema.users.id, req.user!.id)).returning();
    res.json({ user: auth.toPublicUser(u) });
  }),
);
