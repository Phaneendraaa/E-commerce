'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Gift, Heart, LayoutGrid, MapPin, Package, UserRound } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { Spinner } from '@/components/ui';

const NAV = [
  { href: '/account', label: 'Overview', icon: LayoutGrid },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/rewards', label: 'Rewards & referrals', icon: Gift },
  { href: '/account/profile', label: 'Profile & security', icon: UserRound },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'guest') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== 'authed' || !user) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner size={28} />
      </div>
    );
  }

  const active = (href: string) => (href === '/account' ? pathname === href : pathname.startsWith(href));

  return (
    <div className="container-x py-4 md:py-6">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <div className="hidden lg:block">
            <div className="text-sm text-muted">Hello,</div>
            <div className="font-display text-2xl font-bold">{user.name.split(' ')[0]}</div>
          </div>
          <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:mt-6 lg:flex-col lg:gap-0.5 lg:px-0" aria-label="Account">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium lg:rounded-[var(--radius-sm)] lg:px-3 lg:py-2.5 ${active(n.href) ? 'bg-ink text-white' : 'bg-surface ring-1 ring-line hover:bg-tile lg:bg-transparent lg:ring-0'}`}
              >
                <n.icon size={17} /> {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
