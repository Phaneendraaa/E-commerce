'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { Spinner } from '@/components/ui';

function Section({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius)] bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 className="font-sans text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user!.name);
  const [savingName, setSavingName] = useState(false);
  const [phone, setPhone] = useState(user!.phone?.replace('+91', '') ?? '');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const u = user!;

  const patch = async (body: Partial<User>) => {
    try {
      const r = await api<{ user: User }>('/users/me', { method: 'PATCH', body });
      setUser(r.user);
      toast.success('Preferences saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-[32px] md:text-[40px]">Profile & security</h1>

      <Section title="Personal details">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingName(true);
            await patch({ name });
            setSavingName(false);
          }}
        >
          <label className="block min-w-[220px] flex-1">
            <span className="label">Full name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
          </label>
          <button disabled={savingName || name === u.name} className="btn btn-primary">
            {savingName ? <Spinner /> : 'Save'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          <span className="text-muted">Email:</span> {u.email ?? '—'} {u.emailVerified && <BadgeCheck size={15} className="inline text-peacock" />}
        </p>
      </Section>

      <Section title="Mobile number" hint="Used for OTP sign-in and WhatsApp order updates.">
        {u.phone && u.phoneVerified && !codeSent ? (
          <p className="flex items-center gap-2 text-sm">
            {u.phone} <BadgeCheck size={16} className="text-peacock" /> <span className="text-peacock">Verified</span>
          </p>
        ) : null}
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy('phone');
            try {
              if (!codeSent) {
                const r = await api<{ devCode?: string }>('/auth/verify-phone/send', { body: { phone, channel: 'WHATSAPP' } });
                setCodeSent(true);
                toast.success('Code sent on WhatsApp');
                if (r.devCode) toast.info(`Development mode — your code is ${r.devCode}`, { duration: 15000 });
              } else {
                const r = await api<{ user: User }>('/auth/verify-phone/confirm', { body: { phone, code } });
                setUser(r.user);
                setCodeSent(false);
                setCode('');
                toast.success('Mobile number verified');
              }
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(null);
            }
          }}
        >
          <label className="block min-w-[200px] flex-1">
            <span className="label">{u.phone ? 'Change number' : 'Add number'}</span>
            <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="98765 43210" disabled={codeSent} />
          </label>
          {codeSent && (
            <label className="block w-36">
              <span className="label">Code</span>
              <input className="field text-center tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" />
            </label>
          )}
          <button disabled={busy === 'phone' || phone.length < 10} className="btn btn-outline">
            {busy === 'phone' ? <Spinner /> : codeSent ? 'Verify' : 'Send code'}
          </button>
        </form>
      </Section>

      <Section title="Notifications">
        <div className="space-y-4">
          {(
            [
              ['whatsappOptIn', 'WhatsApp order updates', 'Shipping, delivery and tracking reminders on WhatsApp'],
              ['marketingOptIn', 'Offers & new arrivals', 'Occasional emails about sales and launches'],
            ] as const
          ).map(([k, title, body]) => (
            <label key={k} className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="block font-medium">{title}</span>
                <span className="text-sm text-muted">{body}</span>
              </span>
              <input type="checkbox" className="mt-1 size-5 accent-[var(--ink)]" checked={u[k]} onChange={(e) => patch({ [k]: e.target.checked })} />
            </label>
          ))}
        </div>
      </Section>

      <Section title={u.hasPassword ? 'Change password' : 'Set a password'} hint={u.hasPassword ? undefined : 'You signed up with a one-time code. Add a password to sign in with it too.'}>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy('pw');
            try {
              await api('/auth/password/change', { body: { currentPassword: pw.current || undefined, newPassword: pw.next } });
              toast.success('Password updated');
              setPw({ current: '', next: '' });
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(null);
            }
          }}
        >
          {u.hasPassword && (
            <label className="block">
              <span className="label">Current password</span>
              <input type="password" className="field" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
            </label>
          )}
          <label className="block">
            <span className="label">New password</span>
            <input type="password" className="field" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} minLength={8} autoComplete="new-password" required />
          </label>
          <button disabled={busy === 'pw'} className="btn btn-primary">
            {busy === 'pw' ? <Spinner /> : 'Update'}
          </button>
        </form>
      </Section>

      <Section title="Sessions">
        <button
          onClick={async () => {
            await api('/auth/logout-all', { method: 'POST' }).catch(() => undefined);
            await logout();
            location.href = '/login';
          }}
          className="btn btn-outline btn-sm"
        >
          Sign out of all devices
        </button>
      </Section>
    </div>
  );
}
