import type { ReactNode } from 'react';

/** Two-panel frame for sign-in / sign-up screens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="container-x py-10 md:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[var(--radius-lg)] bg-surface ring-1 ring-line md:grid-cols-[1fr_1.1fr]">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-white md:flex">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-marigold/90" />
          <div className="absolute -bottom-28 -left-16 size-64 rounded-full border-[28px] border-white/10" />
          <p className="relative max-w-[16ch] font-display text-[44px] font-extrabold leading-[0.95]" style={{ letterSpacing: '-0.035em' }}>
            Your favourites, one tap away.
          </p>
          <ul className="relative space-y-3 text-sm text-white/80">
            <li>Track every order on WhatsApp</li>
            <li>Earn points on every purchase</li>
            <li>Save addresses for 1-tap checkout</li>
          </ul>
        </div>
        <div className="p-6 sm:p-10">
          <h1 className="text-3xl md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
