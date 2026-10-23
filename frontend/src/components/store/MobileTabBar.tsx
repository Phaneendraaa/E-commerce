'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, ShoppingCart, User } from 'lucide-react';

/** Pages that bring their own sticky action bar (or are focused flows). */
const HIDE_ON = /^\/(product|checkout|cart|login|register|forgot-password|reset-password)(\/|$)/;

export function MobileTabBar({ count, onCategories, onCart, signedIn }: { count: number; onCategories: () => void; onCart: () => void; signedIn: boolean }) {
  const pathname = usePathname();
  if (HIDE_ON.test(pathname)) return null;

  const base = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10.5px] font-semibold';
  const tone = (on: boolean) => (on ? 'text-ink' : 'text-faint');
  const dot = <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-marigold" aria-hidden />;
  const home = pathname === '/';
  const acct = pathname.startsWith('/account');

  return (
    <nav aria-label="Primary" className="tabbar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,46,29,.06)] lg:hidden">
      <div className="mx-auto flex h-14 max-w-md">
        <Link href="/" className={`${base} ${tone(home)}`} aria-current={home ? 'page' : undefined}>
          {home && dot}
          <Home size={21} strokeWidth={home ? 2.4 : 1.9} />
          Home
        </Link>
        <button onClick={onCategories} className={`${base} ${tone(false)}`}>
          <LayoutGrid size={21} strokeWidth={1.9} />
          Categories
        </button>
        <button onClick={onCart} className={`${base} ${tone(false)}`} aria-label={`Cart, ${count} items`}>
          <span className="relative">
            <ShoppingCart size={21} strokeWidth={1.9} />
            {count > 0 && <span className="absolute -top-1.5 -right-2.5 grid min-w-[16px] place-items-center rounded-full bg-marigold px-1 text-[10px] leading-4 font-bold text-ink">{count}</span>}
          </span>
          Cart
        </button>
        <Link href={signedIn ? '/account' : '/login?next=/account'} className={`${base} ${tone(acct)}`} aria-current={acct ? 'page' : undefined}>
          {acct && dot}
          <User size={21} strokeWidth={acct ? 2.4 : 1.9} />
          {signedIn ? 'Account' : 'Login'}
        </Link>
      </div>
    </nav>
  );
}
