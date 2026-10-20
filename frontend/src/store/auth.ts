'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

type Status = 'idle' | 'loading' | 'authed' | 'guest';

interface AuthState {
  user: User | null;
  status: Status;
  bootstrap: () => Promise<void>;
  setUser: (u: User | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',

  async bootstrap() {
    if (get().status !== 'idle') return;
    set({ status: 'loading' });
    try {
      const { user } = await api<{ user: User }>('/auth/me');
      set({ user, status: 'authed' });
    } catch {
      set({ user: null, status: 'guest' });
    }
  },

  setUser(user) {
    set({ user, status: user ? 'authed' : 'guest' });
  },

  async refreshUser() {
    try {
      const { user } = await api<{ user: User }>('/auth/me');
      set({ user, status: 'authed' });
    } catch {
      set({ user: null, status: 'guest' });
    }
  },

  async logout() {
    await api('/auth/logout', { method: 'POST', noRefresh: true }).catch(() => undefined);
    set({ user: null, status: 'guest' });
  },
}));

export const isStaff = (u: User | null) => Boolean(u && u.role !== 'CUSTOMER');
