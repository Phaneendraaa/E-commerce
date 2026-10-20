'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { track } from '@/lib/track';
import { useAuth } from './auth';

interface WishlistState {
  ids: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (productId: string, name?: string) => Promise<void>;
  clear: () => void;
}

export const useWishlist = create<WishlistState>((set, get) => ({
  ids: new Set(),
  loaded: false,

  async load() {
    if (useAuth.getState().status !== 'authed') return;
    try {
      const { ids } = await api<{ ids: string[] }>('/wishlist');
      set({ ids: new Set(ids), loaded: true });
    } catch {
      /* ignore */
    }
  },

  async toggle(productId, name) {
    if (useAuth.getState().status !== 'authed') {
      toast('Sign in to save items to your wishlist', { action: { label: 'Sign in', onClick: () => (location.href = `/login?next=${encodeURIComponent(location.pathname)}`) } });
      return;
    }
    const has = get().ids.has(productId);
    const next = new Set(get().ids);
    if (has) next.delete(productId);
    else next.add(productId);
    set({ ids: next });
    try {
      await api(`/wishlist/${productId}`, { method: has ? 'DELETE' : 'POST' });
      if (!has) {
        track({ type: 'WISHLIST_ADD', productId });
        toast.success(name ? `Saved ${name} to your wishlist` : 'Saved to your wishlist');
      }
    } catch {
      set({ ids: get().ids }); // revert silently on failure
    }
  },

  clear: () => set({ ids: new Set(), loaded: false }),
}));
