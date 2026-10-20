'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { User } from './types';
import { useAuth } from '@/store/auth';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';

/** Shared post-sign-in routine: store the user, merge the guest cart, then redirect. */
export function useSignedIn() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useAuth((s) => s.setUser);
  const merge = useCart((s) => s.mergeGuest);
  const loadWishlist = useWishlist((s) => s.load);

  return async (user: User, opts: { isNew?: boolean } = {}) => {
    setUser(user);
    await merge();
    void loadWishlist();
    toast.success(opts.isNew ? `Welcome, ${user.name.split(' ')[0]}! Your account is ready.` : `Welcome back, ${user.name.split(' ')[0]}`);
    const next = params.get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : user.role !== 'CUSTOMER' ? '/admin' : '/';
    router.replace(safe);
    router.refresh();
  };
}
