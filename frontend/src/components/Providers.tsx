'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { useAuth } from '@/store/auth';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';
import { captureUtm, track } from '@/lib/track';

/** Boots the session once, keeps cart/wishlist in sync with auth, and logs page views. */
export function Providers({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const loadCart = useCart((s) => s.load);
  const loadWishlist = useWishlist((s) => s.load);
  const pathname = usePathname();

  useEffect(() => {
    captureUtm();
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === 'authed' || status === 'guest') {
      void loadCart();
      if (status === 'authed') void loadWishlist();
    }
  }, [status, loadCart, loadWishlist]);

  useEffect(() => {
    if (!pathname.startsWith('/admin')) track({ type: 'PAGE_VIEW', path: pathname, referrer: document.referrer || undefined });
  }, [pathname]);

  return (
    <>
      {children}
      <Toaster position="bottom-center" toastOptions={{ style: { fontFamily: 'var(--font-body)', borderRadius: 'var(--radius)' } }} richColors closeButton />
    </>
  );
}
