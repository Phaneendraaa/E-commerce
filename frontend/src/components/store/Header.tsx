'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Heart, LayoutDashboard, LogOut, Menu, Package, Search, ShoppingBag, User, X } from 'lucide-react';
import type { Category, StoreSettings } from '@/lib/types';
import { useAuth, isStaff } from '@/store/auth';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';
import { SearchBox } from './SearchBox';
import { Sheet } from '@/components/ui';

export function Header({ settings, categories }: { settings: Pick<StoreSettings, 'storeName' | 'announcement'>; categories: Category[] }) {
  const { user, status, logout } = useAuth();
  const count = useCart((s) => s.cart?.itemCount ?? 0);
  const openDrawer = useCart((s) => s.openDrawer);
  const resetCart = useCart((s) => s.reset);
  const wishCount = useWishlist((s) => s.ids.size);
  const clearWishlist = useWishlist((s) => s.clear);
  const [menu, setMenu] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [account, setAccount] = useState(false);
  const pathname = usePathname();

  const signOut = async () => {
    await logout();
    resetCart();
    clearWishlist();
    setAccount(false);
  };

  return (
    <>
      {settings.announcement && <div className="bg-marigold px-4 py-2 text-center text-[13px] font-semibold text-ink">{settings.announcement}</div>}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="container-x flex h-16 items-center gap-3 md:gap-6">
          <button className="btn btn-ghost btn-sm !px-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <Link href="/" className="font-display text-[22px] font-extrabold tracking-tight md:text-[26px]">
            {settings.storeName}
          </Link>
          <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Categories">
            {categories.slice(0, 5).map((c) => (
              <div key={c.id} className="group relative">
                <Link
                  href={`/shop?category=${c.slug}`}
                  className={`flex items-center gap-1 rounded-full px-3 py-2 text-[14px] font-medium hover:bg-tile ${pathname === '/shop' ? '' : ''}`}
                >
                  {c.name}
                  {!!c.children?.length && <ChevronDown size={14} className="text-muted" />}
                </Link>
                {!!c.children?.length && (
                  <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                    <div className="w-56 rounded-[var(--radius)] border border-line bg-surface p-2 shadow-xl">
                      {c.children.map((s) => (
                        <Link key={s.id} href={`/shop?category=${s.slug}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-tile">
                          {s.name}
                          <span className="text-xs text-faint">{s.productCount}</span>
                        </Link>
                      ))}
                      <Link href={`/shop?category=${c.slug}`} className="mt-1 block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-tile">
                        All {c.name.toLowerCase()}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="ml-auto hidden max-w-md flex-1 md:block">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center gap-0.5 md:ml-0">
            <button className="btn btn-ghost btn-sm !px-2 md:hidden" onClick={() => setMobileSearch(true)} aria-label="Search">
              <Search size={21} />
            </button>
            <div className="relative">
              {status === 'authed' ? (
                <button className="btn btn-ghost btn-sm !px-2" onClick={() => setAccount((a) => !a)} aria-label="Account menu" aria-expanded={account}>
                  <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-bold text-white">{user!.name[0]?.toUpperCase()}</span>
                </button>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn btn-ghost btn-sm !px-2" aria-label="Sign in">
                  <User size={21} />
                  <span className="hidden text-sm xl:inline">Sign in</span>
                </Link>
              )}
              {account && user && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" onClick={() => setAccount(false)} aria-label="Close menu" />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-[var(--radius)] border border-line bg-surface p-2 shadow-xl">
                    <div className="px-3 py-2">
                      <div className="font-semibold">{user.name}</div>
                      <div className="truncate text-xs text-muted">{user.email ?? user.phone}</div>
                    </div>
                    {[
                      { href: '/account', label: 'My account', icon: User },
                      { href: '/account/orders', label: 'Orders', icon: Package },
                      { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
                    ].map((l) => (
                      <Link key={l.href} href={l.href} onClick={() => setAccount(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-tile">
                        <l.icon size={16} /> {l.label}
                      </Link>
                    ))}
                    {isStaff(user) && (
                      <Link href="/admin" onClick={() => setAccount(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-tile">
                        <LayoutDashboard size={16} /> Admin dashboard
                      </Link>
                    )}
                    <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-tile">
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
            <Link href="/account/wishlist" className="btn btn-ghost btn-sm relative hidden !px-2 sm:inline-flex" aria-label={`Wishlist, ${wishCount} items`}>
              <Heart size={21} />
              {wishCount > 0 && <span className="absolute right-0.5 top-0 grid min-w-[18px] place-items-center rounded-full bg-rose px-1 text-[10px] font-bold text-white">{wishCount}</span>}
            </Link>
            <button onClick={openDrawer} className="btn btn-ghost btn-sm relative !px-2" aria-label={`Cart, ${count} items`}>
              <ShoppingBag size={21} />
              {count > 0 && <span className="absolute right-0.5 top-0 grid min-w-[18px] place-items-center rounded-full bg-marigold px-1 text-[10px] font-bold text-ink">{count}</span>}
            </button>
          </div>
        </div>
      </header>

      <Sheet open={mobileSearch} onClose={() => setMobileSearch(false)} title="Search" side="right" width="max-w-full">
        <div className="p-4">
          <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
        </div>
      </Sheet>

      <Sheet open={menu} onClose={() => setMenu(false)} title={settings.storeName} width="max-w-xs">
        <nav className="p-3" aria-label="Mobile">
          <Link href="/shop" onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 font-semibold hover:bg-tile">
            Shop all
          </Link>
          <Link href="/shop?deals=true" onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 font-semibold text-rose hover:bg-tile">
            Today’s deals
          </Link>
          <Link href="/offers" onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 font-semibold hover:bg-tile">
            Offers & coupons
          </Link>
          <div className="my-2 border-t border-line" />
          {categories.map((c) => (
            <details key={c.id} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2.5 hover:bg-tile">
                {c.name}
                {!!c.children?.length && <ChevronDown size={16} className="transition group-open:rotate-180" />}
              </summary>
              <div className="ml-3 border-l border-line pl-2">
                <Link href={`/shop?category=${c.slug}`} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-tile">
                  All {c.name.toLowerCase()}
                </Link>
                {c.children?.map((s) => (
                  <Link key={s.id} href={`/shop?category=${s.slug}`} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-tile">
                    {s.name}
                  </Link>
                ))}
              </div>
            </details>
          ))}
          <div className="my-2 border-t border-line" />
          {status === 'authed' ? (
            <>
              <Link href="/account/orders" onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 hover:bg-tile">
                My orders
              </Link>
              {isStaff(user) && (
                <Link href="/admin" onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 font-semibold hover:bg-tile">
                  Admin dashboard
                </Link>
              )}
              <button onClick={() => (signOut(), setMenu(false))} className="block w-full rounded-lg px-3 py-2.5 text-left text-danger hover:bg-tile">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" onClick={() => setMenu(false)} className="btn btn-primary mt-2 w-full">
              Sign in
            </Link>
          )}
        </nav>
        <button className="sr-only" onClick={() => setMenu(false)}>
          <X />
        </button>
      </Sheet>
    </>
  );
}
