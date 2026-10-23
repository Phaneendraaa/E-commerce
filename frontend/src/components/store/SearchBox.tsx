'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Clock, X } from 'lucide-react';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import { Img } from '@/components/ui';
import { track } from '@/lib/track';

interface Suggest {
  products: { id: string; name: string; slug: string; image: string | null; price: number }[];
  categories: { name: string; slug: string }[];
}

const RECENT_KEY = 'sn_recent_searches';
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
};

export function SearchBox({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggest | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<Suggest>('/products/suggest', { query: { q: term }, signal: ctrl.signal })
        .then(setData)
        .catch(() => undefined);
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...readRecent().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setRecent(next);
    track({ type: 'SEARCH', query: t });
    setOpen(false);
    onDone?.();
    router.push(`/shop?q=${encodeURIComponent(t)}`);
  };

  const products = data?.products ?? [];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(products.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Enter' && active >= 0 && products[active]) {
      e.preventDefault();
      setOpen(false);
      onDone?.();
      router.push(`/product/${products[active].slug}`);
    } else if (e.key === 'Escape') setOpen(false);
  };

  const showRecent = open && q.trim().length < 2 && recent.length > 0;
  const showResults = open && q.trim().length >= 2 && data;

  return (
    <div ref={box} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <label className="relative block">
          <span className="sr-only">Search products</span>
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            autoFocus={autoFocus}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder="Search fertilizers, crops, NPK…"
            className="h-10 w-full rounded-[var(--radius-sm)] border border-line bg-tile pl-10 pr-9 text-[14px] outline-none transition placeholder:text-muted/80 focus:border-ink focus:bg-surface"
            role="combobox"
            aria-expanded={Boolean(showResults || showRecent)}
            aria-controls="search-suggestions"
            autoComplete="off"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>
      </form>

      {(showResults || showRecent) && (
        <div id="search-suggestions" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[var(--radius)] border border-line bg-surface shadow-xl">
          {showRecent && (
            <div className="p-2">
              <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted">
                <span>Recent searches</span>
                <button
                  className="hover:text-ink"
                  onClick={() => {
                    localStorage.removeItem(RECENT_KEY);
                    setRecent([]);
                  }}
                >
                  Clear
                </button>
              </div>
              {recent.map((r) => (
                <button key={r} onClick={() => go(r)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-tile">
                  <Clock size={15} className="text-faint" /> {r}
                </button>
              ))}
            </div>
          )}
          {showResults && (
            <div className="p-2">
              {data!.categories.map((c) => (
                <Link key={c.slug} href={`/shop?category=${c.slug}`} onClick={() => (setOpen(false), onDone?.())} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-tile">
                  <Search size={14} className="text-faint" /> <span>{c.name}</span> <span className="text-muted">in categories</span>
                </Link>
              ))}
              {products.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/product/${p.slug}`}
                  onClick={() => (setOpen(false), onDone?.())}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${active === i ? 'bg-tile' : 'hover:bg-tile'}`}
                >
                  <Img src={p.image} alt="" className="size-10 rounded-md bg-tile object-cover" />
                  <span className="line-clamp-1 flex-1 text-sm">{p.name}</span>
                  <span className="price text-sm">{inr(p.price)}</span>
                </Link>
              ))}
              {!products.length && !data!.categories.length && <div className="px-3 py-4 text-sm text-muted">No matches for “{q}”. Try a broader term.</div>}
              <button onClick={() => go(q)} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-tile">
                See all results for “{q}”
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
