'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Boxes,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useAuth, isStaff } from '@/store/auth';
import { Spinner } from '@/components/ui';
import { CommandPalette } from '@/components/admin/CommandPalette';

const NAV = [
  { group: 'Overview', items: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  ] },
  { group: 'Sales', items: [
    { href: '/admin/orders', label: 'Orders', icon: Package },
    { href: '/admin/returns', label: 'Returns', icon: RotateCcw },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/carts', label: 'Abandoned carts', icon: ShoppingCart },
  ] },
  { group: 'Catalog', items: [
    { href: '/admin/products', label: 'Products', icon: Boxes },
    { href: '/admin/inventory', label: 'Inventory', icon: Warehouse },
    { href: '/admin/categories', label: 'Categories & brands', icon: Tag },
    { href: '/admin/reviews', label: 'Reviews & Q&A', icon: MessageSquare },
  ] },
  { group: 'Marketing', items: [
    { href: '/admin/coupons', label: 'Coupons', icon: Tag },
    { href: '/admin/notifications', label: 'Messaging', icon: Bell },
    { href: '/admin/content', label: 'Banners & pages', icon: FileText },
  ] },
  { group: 'System', items: [{ href: '/admin/settings', label: 'Settings', icon: Settings }] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    if (status === 'guest') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (status !== 'authed' || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner size={28} />
      </div>
    );
  }
  if (!isStaff(user)) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-3xl">Staff only</h1>
          <p className="mt-2 text-muted">Your account doesn’t have access to the admin dashboard.</p>
          <Link href="/" className="btn btn-primary mt-6">
            Back to the store
          </Link>
        </div>
      </div>
    );
  }

  const active = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink text-white/75" aria-label="Admin">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/admin" className="font-display text-xl font-extrabold text-white">
          ShopNest <span className="ml-1 rounded bg-marigold px-1.5 py-0.5 align-middle font-sans text-[10px] font-bold text-ink">ADMIN</span>
        </Link>
        <button className="text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.group} className="mt-4">
            <div className="px-3 pb-1.5 text-[11px] font-semibold text-white/40">{g.group}</div>
            {g.items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition ${active(n.href) ? 'bg-white/12 text-white' : 'hover:bg-white/6 hover:text-white'}`}
              >
                <n.icon size={17} className={active(n.href) ? 'text-marigold' : ''} /> {n.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm hover:bg-white/6 hover:text-white">
          <ExternalLink size={16} /> View store
        </Link>
        <button
          onClick={async () => {
            await logout();
            router.replace('/login');
          }}
          className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm hover:bg-white/6 hover:text-white"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="animate-slide-in absolute inset-y-0 left-0 w-64 [animation-direction:reverse]">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-8">
          <button className="btn btn-ghost btn-sm !px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <button onClick={() => setPalette(true)} className="flex h-9 w-full max-w-sm items-center gap-2 rounded-full bg-tile px-3.5 text-sm text-faint hover:text-muted">
            <Search size={16} /> Search orders, customers, products
            <kbd className="ml-auto hidden rounded border border-line bg-surface px-1.5 text-[11px] text-muted sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-sm leading-tight sm:block">
              <div className="font-semibold">{user.name}</div>
              <div className="text-xs text-muted">{user.role[0] + user.role.slice(1).toLowerCase()}</div>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-bold text-white">{user.name[0]}</span>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
