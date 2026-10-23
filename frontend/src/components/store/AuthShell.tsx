import type { ReactNode } from 'react';
import { Sprout } from 'lucide-react';

/** Two-panel frame for sign-in / sign-up screens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="container-x py-4 md:py-10">
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-[var(--radius)] border border-line bg-surface md:grid-cols-[1fr_1.15fr]">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-8 text-white md:flex">
          <div className="absolute -right-20 -top-20 size-60 rounded-full bg-marigold/90" />
          <div className="absolute -bottom-24 -left-14 size-56 rounded-full border-[24px] border-white/10" />
          <Sprout size={28} className="relative text-ink" />
          <p className="relative max-w-[14ch] font-display text-[32px] leading-[1.05] font-semibold">Everything your crop needs, one tap away.</p>
          <ul className="relative space-y-2.5 text-[13px] text-white/85">
            <li>Track every order on WhatsApp</li>
            <li>Earn reward points on every order</li>
            <li>Save farm addresses for quick checkout</li>
          </ul>
        </div>
        <div className="p-4 sm:p-8">
          <h1 className="text-[22px] md:text-[26px]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
