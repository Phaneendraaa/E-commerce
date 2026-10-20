'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, Package, Search, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import { Img, Sheet } from '@/components/ui';

interface Results {
  orders: { id: string; orderNumber: string; status: string; total: number }[];
  customers: { id: string; name: string; email: string | null; phone: string | null }[];
  products: { id: string; name: string; image: string | null }[];
}

const SHORTCUTS = [
  { label: 'Orders waiting to ship', href: '/admin/orders?status=CONFIRMED,PROCESSING,PACKED' },
  { label: 'Add a product', href: '/admin/products/new' },
  { label: 'Low-stock inventory', href: '/admin/inventory' },
  { label: 'Create a coupon', href: '/admin/coupons' },
  { label: 'Send a broadcast', href: '/admin/notifications' },
];

/** ⌘K global search across orders, customers and products. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [r, setR] = useState<Results | null>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      setR(null);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return setR(null);
    const t = setTimeout(() => {
      api<Results>('/admin/search', { query: { q } })
        .then(setR)
        .catch(() => undefined);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const Row = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm hover:bg-tile focus:bg-tile focus:outline-none">
      {children}
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} side="center" width="max-w-xl">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search size={18} className="text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, customer name/phone, product…" className="h-14 flex-1 bg-transparent text-[15px] outline-none" aria-label="Search" />
        <kbd className="rounded border border-line px-1.5 text-[11px] text-muted">Esc</kbd>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {!r && (
          <>
            <div className="px-3 py-1.5 text-xs text-muted">Quick actions</div>
            {SHORTCUTS.map((s) => (
              <Row key={s.href} onClick={() => go(s.href)}>
                {s.label}
              </Row>
            ))}
          </>
        )}
        {r && (
          <>
            {!!r.orders.length && <div className="px-3 py-1.5 text-xs text-muted">Orders</div>}
            {r.orders.map((o) => (
              <Row key={o.id} onClick={() => go(`/admin/orders/${o.id}`)}>
                <Package size={16} className="text-muted" /> <b>{o.orderNumber}</b>
                <span className="text-muted">{o.status.toLowerCase().replace(/_/g, ' ')}</span>
                <span className="ml-auto">{inr(o.total)}</span>
              </Row>
            ))}
            {!!r.customers.length && <div className="px-3 py-1.5 text-xs text-muted">Customers</div>}
            {r.customers.map((c) => (
              <Row key={c.id} onClick={() => go(`/admin/customers/${c.id}`)}>
                <Users size={16} className="text-muted" /> {c.name}
                <span className="truncate text-muted">{c.email ?? c.phone}</span>
              </Row>
            ))}
            {!!r.products.length && <div className="px-3 py-1.5 text-xs text-muted">Products</div>}
            {r.products.map((p) => (
              <Row key={p.id} onClick={() => go(`/admin/products/${p.id}`)}>
                {p.image ? <Img src={p.image} alt="" className="size-7 rounded bg-tile object-cover" /> : <Boxes size={16} />} {p.name}
              </Row>
            ))}
            {!r.orders.length && !r.customers.length && !r.products.length && <p className="px-3 py-6 text-center text-sm text-muted">No matches for “{q}”.</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
