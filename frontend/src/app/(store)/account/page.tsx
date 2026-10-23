'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gift, Heart, MapPin, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { date, inr } from '@/lib/format';
import type { Order, Paged } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useWishlist } from '@/store/wishlist';
import { Img } from '@/components/ui';
import { StatusBadge } from '@/components/store/OrderBits';

export default function AccountOverview() {
  const user = useAuth((s) => s.user)!;
  const wish = useWishlist((s) => s.ids.size);
  const [orders, setOrders] = useState<Paged<Order> | null>(null);

  useEffect(() => {
    api<Paged<Order>>('/orders', { query: { limit: 3 } })
      .then(setOrders)
      .catch(() => undefined);
  }, []);

  const cards = [
    { href: '/account/orders', icon: Package, label: 'Orders', value: orders?.total ?? '—' },
    { href: '/account/wishlist', icon: Heart, label: 'Wishlist', value: wish },
    { href: '/account/rewards', icon: Gift, label: 'Reward points', value: user.loyaltyPoints },
    { href: '/account/addresses', icon: MapPin, label: 'Addresses', value: 'Manage' },
  ];

  return (
    <div>
      <h1 className="text-[22px] md:text-[28px]">My account</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line hover:ring-ink">
            <c.icon size={20} className="text-peacock" />
            <div className="mt-3 font-display text-2xl font-bold">{c.value}</div>
            <div className="text-sm text-muted">{c.label}</div>
          </Link>
        ))}
      </div>

      {user.loyaltyPoints > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] bg-marigold-soft p-5">
          <div>
            <div className="font-semibold">You have {user.loyaltyPoints} points</div>
            <div className="text-sm text-muted">Worth up to {inr(user.loyaltyPoints * 100)} off — apply them at checkout.</div>
          </div>
          <Link href="/shop" className="btn btn-primary btn-sm">
            Use points
          </Link>
        </div>
      )}

      <div className="mt-10 flex items-end justify-between">
        <h2 className="text-2xl">Recent orders</h2>
        <Link href="/account/orders" className="text-sm font-semibold underline decoration-marigold decoration-2 underline-offset-4">
          All orders
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {orders?.items.map((o) => (
          <Link key={o.id} href={`/account/orders/${o.orderNumber}`} className="flex items-center gap-4 rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line hover:ring-ink">
            <div className="flex -space-x-3">
              {o.items.slice(0, 3).map((i, k) => (
                <Img key={k} src={i.image} alt="" className="size-12 rounded-[var(--radius-sm)] bg-tile object-cover ring-2 ring-surface" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{o.orderNumber}</div>
              <div className="text-sm text-muted">
                {date(o.createdAt)} · {inr(o.total)}
              </div>
            </div>
            <StatusBadge status={o.status} />
          </Link>
        ))}
        {orders && !orders.items.length && <p className="text-muted">No orders yet.</p>}
      </div>
    </div>
  );
}
