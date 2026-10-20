'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { track } from '@/lib/track';
import type { Cart } from '@/lib/types';
import { useAuth } from './auth';

/**
 * Cart works for guests and signed-in customers alike:
 *  - guests keep { variantId, quantity } in localStorage and get live prices from /cart/quote
 *  - signed-in users use the server cart (enables abandoned-cart reminders)
 *  - on sign-in the guest cart is merged into the server cart
 */
interface GuestLine {
  variantId: string;
  quantity: number;
}

const GUEST_KEY = 'sn_cart';
const GUEST_COUPON = 'sn_cart_coupon';

const readGuest = (): GuestLine[] => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]');
  } catch {
    return [];
  }
};
const writeGuest = (lines: GuestLine[]) => {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable */
  }
};
const guestCoupon = () => {
  try {
    return localStorage.getItem(GUEST_COUPON);
  } catch {
    return null;
  }
};
const setGuestCoupon = (c: string | null) => {
  try {
    if (c) localStorage.setItem(GUEST_COUPON, c);
    else localStorage.removeItem(GUEST_COUPON);
  } catch {
    /* ignore */
  }
};

const authed = () => useAuth.getState().status === 'authed';

interface CartState {
  cart: Cart | null;
  loading: boolean;
  drawerOpen: boolean;
  pending: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  load: () => Promise<void>;
  add: (variantId: string, quantity?: number, meta?: { productId?: string; price?: number; name?: string; silent?: boolean }) => Promise<boolean>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  mergeGuest: () => Promise<void>;
  reset: () => void;
}

export const useCart = create<CartState>((set, get) => ({
  cart: null,
  loading: false,
  drawerOpen: false,
  pending: null,

  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),

  async load() {
    set({ loading: true });
    try {
      if (authed()) {
        const { cart } = await api<{ cart: Cart }>('/cart');
        set({ cart });
      } else {
        const items = readGuest();
        if (!items.length) {
          set({ cart: null });
          return;
        }
        const { cart } = await api<{ cart: Cart }>('/cart/quote', { body: { items, couponCode: guestCoupon() } });
        // Drop lines the API no longer recognises
        const known = new Set(cart.lines.map((l) => l.variantId));
        writeGuest(items.filter((i) => known.has(i.variantId)));
        set({ cart });
      }
    } catch {
      /* keep previous cart */
    } finally {
      set({ loading: false });
    }
  },

  async add(variantId, quantity = 1, meta = {}) {
    set({ pending: variantId });
    try {
      if (authed()) {
        const { cart } = await api<{ cart: Cart }>('/cart/items', { body: { variantId, quantity } });
        set({ cart });
      } else {
        const items = readGuest();
        const found = items.find((i) => i.variantId === variantId);
        if (found) found.quantity = Math.min(10, found.quantity + quantity);
        else items.push({ variantId, quantity });
        writeGuest(items);
        await get().load();
      }
      track({ type: 'ADD_TO_CART', productId: meta.productId, value: meta.price ? meta.price * quantity : undefined });
      if (!meta.silent) {
        toast.success(meta.name ? `${meta.name} added to your cart` : 'Added to your cart', { action: { label: 'View cart', onClick: () => get().openDrawer() } });
      }
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      set({ pending: null });
    }
  },

  async setQuantity(variantId, quantity) {
    if (quantity <= 0) return get().remove(variantId);
    set({ pending: variantId });
    try {
      if (authed()) {
        const { cart } = await api<{ cart: Cart }>(`/cart/items/${variantId}`, { method: 'PATCH', body: { quantity } });
        set({ cart });
      } else {
        writeGuest(readGuest().map((i) => (i.variantId === variantId ? { ...i, quantity } : i)));
        await get().load();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      set({ pending: null });
    }
  },

  async remove(variantId) {
    const line = get().cart?.lines.find((l) => l.variantId === variantId);
    set({ pending: variantId });
    try {
      if (authed()) {
        const { cart } = await api<{ cart: Cart }>(`/cart/items/${variantId}`, { method: 'DELETE' });
        set({ cart });
      } else {
        writeGuest(readGuest().filter((i) => i.variantId !== variantId));
        await get().load();
      }
      track({ type: 'REMOVE_FROM_CART', productId: line?.productId });
    } finally {
      set({ pending: null });
    }
  },

  async applyCoupon(code) {
    try {
      if (authed()) {
        const r = await api<{ cart: Cart; message: string }>('/cart/coupon', { body: { code } });
        set({ cart: r.cart });
        toast.success(r.message);
      } else {
        const { cart } = await api<{ cart: Cart }>('/cart/quote', { body: { items: readGuest(), couponCode: code } });
        if (!cart.coupon?.valid) throw new Error(cart.coupon?.message ?? 'Invalid coupon');
        setGuestCoupon(cart.coupon.code);
        set({ cart });
        toast.success(cart.coupon.message);
      }
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  },

  async removeCoupon() {
    if (authed()) {
      const { cart } = await api<{ cart: Cart }>('/cart/coupon', { method: 'DELETE' });
      set({ cart });
    } else {
      setGuestCoupon(null);
      await get().load();
    }
  },

  /** Call right after sign-in. */
  async mergeGuest() {
    const items = readGuest();
    try {
      if (items.length) {
        const { cart } = await api<{ cart: Cart }>('/cart/merge', { body: { items, couponCode: guestCoupon() } });
        set({ cart });
        writeGuest([]);
        setGuestCoupon(null);
      } else {
        await get().load();
      }
    } catch {
      await get().load();
    }
  },

  reset() {
    writeGuest([]);
    setGuestCoupon(null);
    set({ cart: null });
  },
}));
