'use client';

/**
 * First-party analytics: batches storefront events and ships them to /api/track.
 * Sessions expire after 30 minutes of inactivity. UTM params are captured on
 * landing and attached to every event (and to the order at checkout).
 */
type EventType = 'PAGE_VIEW' | 'PRODUCT_VIEW' | 'SEARCH' | 'ADD_TO_CART' | 'REMOVE_FROM_CART' | 'WISHLIST_ADD' | 'BEGIN_CHECKOUT' | 'ADD_PAYMENT_INFO';

interface TrackEvent {
  type: EventType;
  path?: string;
  referrer?: string;
  productId?: string;
  query?: string;
  value?: number;
  meta?: Record<string, unknown>;
}

const SESSION_KEY = 'sn_session';
const UTM_KEY = 'sn_utm';
const IDLE_MS = 30 * 60_000;
let queue: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function sessionId(): string {
  return safe(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    const now = Date.now();
    if (raw) {
      const s = JSON.parse(raw) as { id: string; at: number };
      if (now - s.at < IDLE_MS) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id: s.id, at: now }));
        return s.id;
      }
    }
    const id = `s_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, at: now }));
    return id;
  }, 'anon_session');
}

export function captureUtm() {
  safe(() => {
    const p = new URLSearchParams(location.search);
    const source = p.get('utm_source');
    if (source) sessionStorage.setItem(UTM_KEY, JSON.stringify({ source, medium: p.get('utm_medium') ?? undefined, campaign: p.get('utm_campaign') ?? undefined }));
  }, undefined);
}

export function utm(): { source?: string; medium?: string; campaign?: string } | undefined {
  return safe(() => JSON.parse(sessionStorage.getItem(UTM_KEY) || 'null') ?? undefined, undefined);
}

export function device() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function flush(useBeacon = false) {
  if (!queue.length) return;
  const payload = JSON.stringify({ sessionId: sessionId(), utm: utm(), events: queue.splice(0, 25) });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
  } else {
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true, credentials: 'include' }).catch(() => undefined);
  }
  if (queue.length) flush(useBeacon);
}

export function track(e: TrackEvent) {
  if (typeof window === 'undefined') return;
  queue.push({ path: location.pathname, ...e });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => flush(), 2500);
}

if (typeof window !== 'undefined') {
  addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush(true));
}
