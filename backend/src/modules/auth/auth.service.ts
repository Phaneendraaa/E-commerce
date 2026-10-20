import bcrypt from 'bcryptjs';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { OAuth2Client } from 'google-auth-library';
import { db, schema } from '../../db';
import type { Role } from '../../db/schema';
import { env } from '../../config/env';
import { generateOtp, generateRefreshToken, hashOtp, hashToken, safeEqual, signAccessToken } from '../../lib/tokens';
import { badRequest, conflict, forbidden, tooMany, unauthorized } from '../../utils/errors';
import { normalizePhone } from '../../utils/format';
import { notify, notifyAsync } from '../notifications/notify';

const { users, refreshTokens, otpCodes } = schema;
const referralCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_GAP_MS = 30_000;

export type PublicUser = ReturnType<typeof toPublicUser>;

export function toPublicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    avatar: u.avatar,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    whatsappOptIn: u.whatsappOptIn,
    marketingOptIn: u.marketingOptIn,
    loyaltyPoints: u.loyaltyPoints,
    referralCode: u.referralCode,
    hasPassword: Boolean(u.passwordHash),
    createdAt: u.createdAt,
  };
}

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export async function issueSession(user: { id: string; role: Role }, meta: SessionMeta = {}) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const { token, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 86_400_000);
  await db.insert(refreshTokens).values({ userId: user.id, tokenHash: hash, expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300) });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { accessToken, refreshToken: token, refreshExpiresAt: expiresAt };
}

async function resolveReferrer(code?: string | null) {
  if (!code) return null;
  const r = await db.query.users.findFirst({ where: eq(users.referralCode, code.trim().toUpperCase()) });
  return r?.id ?? null;
}

async function createUser(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  passwordHash?: string | null;
  googleId?: string | null;
  avatar?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  referral?: string | null;
}) {
  const referredById = await resolveReferrer(data.referral);
  const [u] = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email?.toLowerCase() ?? null,
      phone: data.phone ?? null,
      passwordHash: data.passwordHash ?? null,
      googleId: data.googleId ?? null,
      avatar: data.avatar ?? null,
      emailVerified: data.emailVerified ?? false,
      phoneVerified: data.phoneVerified ?? false,
      referralCode: referralCode(),
      referredById,
    })
    .returning();
  notifyAsync({ template: 'WELCOME', data: { name: u.name, referralCode: u.referralCode }, channels: ['EMAIL', 'WHATSAPP'], userId: u.id });
  return u;
}

function assertActive(u: typeof users.$inferSelect) {
  if (u.isBlocked) throw forbidden('This account has been suspended. Please contact support.');
}

// ───────────── Password auth ─────────────

export async function register(input: { name: string; email: string; phone?: string; password: string; referralCode?: string }) {
  const email = input.email.toLowerCase();
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) throw badRequest('Please enter a valid mobile number');

  const existing = await db.query.users.findFirst({
    where: phone ? or(eq(users.email, email), eq(users.phone, phone)) : eq(users.email, email),
  });
  if (existing) throw conflict(existing.email === email ? 'An account with this email already exists' : 'An account with this phone number already exists');

  return createUser({ name: input.name, email, phone, passwordHash: await bcrypt.hash(input.password, 12), referral: input.referralCode });
}

export async function login(identifier: string, password: string) {
  const phone = normalizePhone(identifier);
  const u = await db.query.users.findFirst({
    where: identifier.includes('@') ? eq(users.email, identifier.toLowerCase()) : phone ? eq(users.phone, phone) : eq(users.email, identifier),
  });
  // Constant-ish time: always run a bcrypt compare
  const ok = await bcrypt.compare(password, u?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!u || !u.passwordHash || !ok) throw unauthorized('Incorrect email/phone or password');
  assertActive(u);
  return u;
}

// ───────────── OTP ─────────────

type OtpPurpose = (typeof schema.otpPurposeEnum.enumValues)[number];

export async function sendOtp(rawTarget: string, purpose: OtpPurpose, channel: 'SMS' | 'WHATSAPP' | 'EMAIL' = 'SMS') {
  const isEmail = rawTarget.includes('@');
  const target = isEmail ? rawTarget.toLowerCase() : normalizePhone(rawTarget);
  if (!target) throw badRequest('Please enter a valid mobile number or email');

  const recent = await db.query.otpCodes.findFirst({
    where: and(eq(otpCodes.target, target), eq(otpCodes.purpose, purpose)),
    orderBy: desc(otpCodes.createdAt),
  });
  if (recent && Date.now() - recent.createdAt.getTime() < OTP_RESEND_GAP_MS) {
    throw tooMany('Please wait 30 seconds before requesting another code');
  }

  const code = generateOtp();
  await db.insert(otpCodes).values({ target, purpose, codeHash: hashOtp(code, target), expiresAt: new Date(Date.now() + OTP_TTL_MS) });

  const ch = isEmail ? 'EMAIL' : channel === 'EMAIL' ? 'SMS' : channel;
  const results = await notify({
    template: purpose === 'RESET_PASSWORD' ? 'PASSWORD_RESET' : 'OTP',
    data: { code, email: isEmail ? target : undefined },
    channels: [ch],
    to: isEmail ? { email: target } : { phone: target },
    force: true,
  });
  const failed = results.every((r) => r.status === 'FAILED');
  if (failed) throw badRequest('We could not send the code right now. Please try another method.');

  // In development with console providers, return the code so the flow is testable end-to-end.
  const devCode = !env.isProd && results.some((r) => r.status === 'SKIPPED') ? code : undefined;
  return { target, channel: ch, devCode };
}

export async function verifyOtp(rawTarget: string, code: string, purpose: OtpPurpose) {
  const target = rawTarget.includes('@') ? rawTarget.toLowerCase() : normalizePhone(rawTarget);
  if (!target) throw badRequest('Invalid target');
  const otp = await db.query.otpCodes.findFirst({
    where: and(eq(otpCodes.target, target), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())),
    orderBy: desc(otpCodes.createdAt),
  });
  if (!otp) throw badRequest('Code expired. Please request a new one.');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw tooMany('Too many wrong attempts. Please request a new code.');

  if (!safeEqual(otp.codeHash, hashOtp(code, target))) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw badRequest('Incorrect code');
  }
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
  return target;
}

/** OTP login: logs in an existing user, or creates one (name required for new users). */
export async function loginWithOtp(input: { target: string; code: string; name?: string; referralCode?: string }) {
  const target = await verifyOtp(input.target, input.code, 'LOGIN');
  const isEmail = target.includes('@');
  let u = await db.query.users.findFirst({ where: isEmail ? eq(users.email, target) : eq(users.phone, target) });
  let isNew = false;
  if (!u) {
    u = await createUser({
      name: input.name?.trim() || 'Customer',
      email: isEmail ? target : null,
      phone: isEmail ? null : target,
      emailVerified: isEmail,
      phoneVerified: !isEmail,
      referral: input.referralCode,
    });
    isNew = true;
  } else {
    assertActive(u);
    const patch = isEmail ? { emailVerified: true } : { phoneVerified: true };
    [u] = await db.update(users).set(patch).where(eq(users.id, u.id)).returning();
  }
  return { user: u, isNew };
}

// ───────────── Google ─────────────

const googleClient = new OAuth2Client();

export async function loginWithGoogle(credential: string, referral?: string) {
  if (!env.GOOGLE_CLIENT_ID) throw badRequest('Google sign-in is not configured');
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw unauthorized('Google sign-in failed. Please try again.');
  }
  if (!payload?.email || !payload.sub) throw unauthorized('Google account has no email');

  let u = await db.query.users.findFirst({ where: or(eq(users.googleId, payload.sub), eq(users.email, payload.email.toLowerCase())) });
  if (!u) {
    u = await createUser({
      name: payload.name || payload.email.split('@')[0],
      email: payload.email,
      googleId: payload.sub,
      avatar: payload.picture,
      emailVerified: Boolean(payload.email_verified),
      referral,
    });
  } else {
    assertActive(u);
    if (!u.googleId) [u] = await db.update(users).set({ googleId: payload.sub, emailVerified: true, avatar: u.avatar ?? payload.picture }).where(eq(users.id, u.id)).returning();
  }
  return u;
}

// ───────────── Sessions ─────────────

export async function rotateRefreshToken(token: string, meta: SessionMeta) {
  const hash = hashToken(token);
  const row = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, hash) });
  if (!row || row.expiresAt < new Date()) throw unauthorized('Session expired, please sign in again');

  if (row.revokedAt) {
    // Reuse of a rotated token → possible theft. Revoke every session for this user.
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
    throw unauthorized('Session expired, please sign in again');
  }

  const u = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
  if (!u) throw unauthorized();
  assertActive(u);

  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
  const session = await issueSession(u, meta);
  return { user: u, ...session };
}

export async function revokeRefreshToken(token: string) {
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenHash, hashToken(token)));
}

export async function revokeAllSessions(userId: string) {
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

// ───────────── Passwords ─────────────

export async function forgotPassword(email: string) {
  const u = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  // Don't reveal whether the account exists
  if (!u) return { devCode: undefined };
  const r = await sendOtp(email, 'RESET_PASSWORD', 'EMAIL');
  return { devCode: r.devCode };
}

export async function resetPassword(email: string, code: string, password: string) {
  const target = await verifyOtp(email, code, 'RESET_PASSWORD');
  const [u] = await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(password, 12), emailVerified: true })
    .where(eq(users.email, target))
    .returning();
  if (!u) throw badRequest('Account not found');
  await revokeAllSessions(u.id);
  return u;
}

export async function changePassword(userId: string, current: string | undefined, next: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) throw unauthorized();
  if (u.passwordHash && !(await bcrypt.compare(current ?? '', u.passwordHash))) throw badRequest('Current password is incorrect');
  await db.update(users).set({ passwordHash: await bcrypt.hash(next, 12) }).where(eq(users.id, userId));
}
