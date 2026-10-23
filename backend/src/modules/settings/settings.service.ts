import { db, schema } from '../../db';
import { sql } from 'drizzle-orm';

/** Store-wide configuration editable from the admin panel. Money in paise. */
export interface StoreSettings {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  address: string;
  gstin: string;
  currency: string;
  freeShippingThreshold: number;
  shippingFee: number;
  codEnabled: boolean;
  codFee: number;
  codMaxOrderValue: number;
  /** Loyalty points earned per ₹100 spent. */
  loyaltyEarnPer100: number;
  /** Paise value of one loyalty point when redeemed. */
  loyaltyPointValue: number;
  /** Max % of order total payable with points. */
  loyaltyMaxRedeemPercent: number;
  referralBonusPoints: number;
  returnWindowDays: number;
  reviewAutoApprove: boolean;
  /** Days after delivery before asking for a review. */
  reviewRequestDelayDays: number;
  /** Hours after shipping to send a "track your order" reminder. */
  trackingReminderHours: number;
  social: { instagram?: string; facebook?: string; twitter?: string; youtube?: string };
  announcement: string;
}

export const defaultSettings: StoreSettings = {
  storeName: process.env.EMAIL_FROM_NAME || 'Verdant',
  tagline: 'Fertilizers & crop nutrition, delivered to your farm.',
  supportEmail: 'support@shopnest.dev',
  supportPhone: '+91 90000 00000',
  whatsappNumber: '+919000000000',
  address: 'Hyderabad, Telangana, India',
  gstin: '',
  currency: 'INR',
  freeShippingThreshold: 99900,
  shippingFee: 7900,
  codEnabled: true,
  codFee: 3900,
  codMaxOrderValue: 1000000,
  loyaltyEarnPer100: 1,
  loyaltyPointValue: 100,
  loyaltyMaxRedeemPercent: 20,
  referralBonusPoints: 100,
  returnWindowDays: 7,
  reviewAutoApprove: true,
  reviewRequestDelayDays: 3,
  trackingReminderHours: 48,
  social: { instagram: 'https://instagram.com', facebook: 'https://facebook.com' },
  announcement: '🌱 Free delivery above ₹999 · Cash on Delivery · WELCOME10 gives 10% off your first order',
};

const KEY = 'store';
let cache: { value: StoreSettings; at: number } | null = null;
const TTL = 30_000;

export async function getSettings(): Promise<StoreSettings> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const row = await db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, KEY) });
  const value = { ...defaultSettings, ...((row?.value as Partial<StoreSettings>) ?? {}) };
  cache = { value, at: Date.now() };
  return value;
}

export async function updateSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const next = { ...(await getSettings()), ...patch };
  await db
    .insert(schema.settings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: next, updatedAt: sql`now()` } });
  cache = { value: next, at: Date.now() };
  return next;
}

/** Fields safe to expose to the storefront. */
export function publicSettings(s: StoreSettings) {
  const { reviewAutoApprove: _a, ...rest } = s;
  return rest;
}
