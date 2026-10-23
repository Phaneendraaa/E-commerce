'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Heart, LayoutDashboard, LifeBuoy, LogOut, Menu, Package, ShoppingCart, Tag, User } from 'lucide-react';
import type { Category, StoreSettings } from '@/lib/types';
import { useAuth, isStaff } from '@/store/auth';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';
import { SearchBox } from './SearchBox';
import { MobileTabBar } from './MobileTabBar';
import { Img, Sheet } from '@/components/ui';

export function Logo({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-ink">
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
          <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" fill="var(--marigold)" />
          <path d="M5 19c3-5 6-8 10-10" stroke="var(--ink)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-[20px] leading-none font-semibold tracking-tight md:text-[22px]">{name}</span>
    </span>
  );
}

export function Header({ settings, categories }: { settings: Pick<StoreSettings, 'storeName' | 'announcement'>; categories: Category[] }) {
  const { user, status, logout } = useAuth();
  const count = useCart((s) => s.cart?.itemCount ?? 0);
  const openDrawer = useCart((s) => s.openDrawer);
  const resetCart = useCart((s) => s.reset);
  const wishCount = useWishlist((s) => s.ids.size);
  const clearWishlist = useWishlist((s) => s.clear);
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const pathname = usePathname();

  const signOut = async () => {
    await logout();
    resetCart();
    clearWishlist();
    setAccount(false);
  };

  const close = () => setMenu(false);
  const row = 'flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-[14px] hover:bg-tile';

  return (
    <>
      {settings.announcement && (
        <div className="bg-ink px-3 py-1.5 text-center text-[12px] font-medium text-white/90">
          <span className="line-clamp-1">{settings.announcement}</span>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="container-x flex h-12 items-center gap-1.5 md:h-14 md:gap-5">
          <button className="btn btn-ghost btn-sm !h-9 !px-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>
          <Link href="/" aria-label={`${settings.storeName} home`}>
            <Logo name={settings.storeName} />
          </Link>
          <div className="mx-2 hidden max-w-xl flex-1 md:block lg:mx-6">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <div className="relative">
              {status === 'authed' ? (
                <button className="btn btn-ghost btn-sm !h-9 !px-2" onClick={() => setAccount((a) => !a)} aria-label="Account menu" aria-expanded={account}>
                  <span className="grid size-7 place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{user!.name[0]?.toUpperCase()}</span>
                </button>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn btn-ghost btn-sm !h-9 !px-2" aria-label="Sign in">
                  <User size={20} />
                  <span className="hidden text-[13px] font-semibold md:inline">Login</span>
                </Link>
              )}
              {account && user && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" onClick={() => setAccount(false)} aria-label="Close menu" />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-[var(--radius)] border border-line bg-surface p-1.5 shadow-xl">
                    <div className="px-3 py-2">
                      <div className="font-semibold">{user.name}</div>
                      <div className="truncate text-xs text-muted">{user.email ?? user.phone}</div>
                    </div>
                    {[
                      { href: '/account', label: 'My account', icon: User },
                      { href: '/account/orders', label: 'Orders', icon: Package },
                      { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
                    ].map((l) => (
                      <Link key={l.href} href={l.href} onClick={() => setAccount(false)} className={row}>
                        <l.icon size={16} /> {l.label}
                      </Link>
                    ))}
                    {isStaff(user) && (
                      <Link href="/admin" onClick={() => setAccount(false)} className={`${row} font-semibold`}>
                        <LayoutDashboard size={16} /> Admin dashboard
                      </Link>
                    )}
                    <button onClick={signOut} className={`${row} w-full text-danger`}>
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
            <Link href="/account/wishlist" className="btn btn-ghost btn-sm relative !h-9 !px-2" aria-label={`Wishlist, ${wishCount} items`}>
              <Heart size={20} />
              {wishCount > 0 && <span className="absolute right-0 top-0 grid min-w-[16px] place-items-center rounded-full bg-rose px-1 text-[10px] leading-4 font-bold text-white">{wishCount}</span>}
            </Link>
            <button onClick={openDrawer} className="btn btn-ghost btn-sm relative !h-9 !px-2" aria-label={`Cart, ${count} items`}>
              <ShoppingCart size={20} />
              <span className="hidden text-[13px] font-semibold md:inline">Cart</span>
              {count > 0 && <span className="absolute right-0 top-0 grid min-w-[16px] place-items-center rounded-full bg-marigold px-1 text-[10px] leading-4 font-bold text-ink">{count}</span>}
            </button>
          </div>
        </div>

        {/* Mobile: search lives in its own row, like large marketplaces */}
        <div className="container-x pb-2 md:hidden">
          <SearchBox />
        </div>

        {/* Desktop category bar */}
        <nav className="hidden border-t border-line lg:block" aria-label="Categories">
          <div className="container-x flex h-10 items-center gap-1 overflow-x-auto scrollbar-none">
            <Link href="/shop" className="shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-semibold hover:bg-tile">
              All products
            </Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/shop?category=${c.slug}`} className="shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium text-muted hover:bg-tile hover:text-ink">
                {c.name}
              </Link>
            ))}
            <Link href="/shop?deals=true" className="ml-auto shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-semibold text-rose hover:bg-rose-soft">
              Deals
            </Link>
            <Link href="/offers" className="shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-semibold hover:bg-tile">
              Offers
            </Link>
          </div>
        </nav>
      </header>

      <Sheet open={menu} onClose={close} title={<Logo name={settings.storeName} />} side="left" width="max-w-[320px]">
        <nav aria-label="Mobile" className="pb-6">
          {status === 'authed' && user ? (
            <div className="mx-3 mt-3 rounded-[var(--radius)] bg-tile px-4 py-3">
              <div className="text-[15px] font-semibold">Hi, {user.name.split(' ')[0]}</div>
              <div className="truncate text-xs text-muted">{user.email ?? user.phone}</div>
            </div>
          ) : (
            <Link href="/login" onClick={close} className="btn btn-primary mx-3 mt-3 !flex">
              Login / Sign up
            </Link>
          )}

          <div className="px-5 pt-5 pb-1 text-[11px] font-bold tracking-wider text-faint uppercase">Shop by category</div>
          <div className="px-2">
            {categories.map((c) => (
              <Link key={c.id} href={`/shop?category=${c.slug}`} onClick={close} className={row}>
                <Img src={c.image} alt="" className="size-9 shrink-0 rounded-[8px] bg-tile object-cover" />
                <span className="flex-1 font-medium">{c.name}</span>
                <ChevronRight size={16} className="text-faint" />
              </Link>
            ))}
            <Link href="/shop" onClick={close} className={`${row} font-semibold`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-ink text-white">
                <Menu size={16} />
              </span>
              <span className="flex-1">All products</span>
              <ChevronRight size={16} className="text-faint" />
            </Link>
          </div>

          <div className="mx-5 my-3 border-t border-line" />
          <div className="px-2">
            <Link href="/shop?deals=true" onClick={close} className={`${row} font-semibold text-rose`}>
              <Tag size={17} /> Today’s deals
            </Link>
            <Link href="/offers" onClick={close} className={row}>
              <Tag size={17} /> Offers & coupons
            </Link>
            {status === 'authed' && (
              <>
                <Link href="/account/orders" onClick={close} className={row}>
                  <Package size={17} /> My orders
                </Link>
                <Link href="/account/wishlist" onClick={close} className={row}>
                  <Heart size={17} /> Wishlist
                </Link>
              </>
            )}
            <Link href="/pages/faq" onClick={close} className={row}>
              <LifeBuoy size={17} /> Help & FAQs
            </Link>
            {isStaff(user) && (
              <Link href="/admin" onClick={close} className={`${row} font-semibold`}>
                <LayoutDashboard size={17} /> Admin dashboard
              </Link>
            )}
            {status === 'authed' && (
              <button onClick={() => (signOut(), close())} className={`${row} w-full text-danger`}>
                <LogOut size={17} /> Sign out
              </button>
            )}
          </div>
        </nav>
      </Sheet>

      <MobileTabBar count={count} onCategories={() => setMenu(true)} onCart={openDrawer} signedIn={status === 'authed'} />
    </>
  );
}
