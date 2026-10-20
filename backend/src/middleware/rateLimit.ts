import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const common = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
};

/** General API limiter — generous; protects against scraping/abuse. */
export const apiLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 300 });

/** Login/register/password endpoints. */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 30 });

/** OTP sends — expensive (SMS cost) so strict. */
export const otpLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 5 });

/** Analytics beacons. */
export const trackLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 120 });
