'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { Loading, PageHeader, Panel, Table, Toggle, useApi } from '@/components/admin/kit';
import { Spinner } from '@/components/ui';

/* Money settings are stored in paise; edited here in rupees. */
const MONEY = ['freeShippingThreshold', 'shippingFee', 'codFee', 'codMaxOrderValue', 'loyaltyPointValue'];

const SECTIONS: { title: string; description?: string; fields: { key: string; label: string; type: 'text' | 'money' | 'number' | 'bool' | 'textarea'; hint?: string }[] }[] = [
  {
    title: 'Store',
    fields: [
      { key: 'storeName', label: 'Store name', type: 'text' },
      { key: 'tagline', label: 'Tagline', type: 'text' },
      { key: 'announcement', label: 'Announcement bar', type: 'text', hint: 'Shown at the top of every page. Leave empty to hide.' },
      { key: 'supportEmail', label: 'Support email', type: 'text' },
      { key: 'supportPhone', label: 'Support phone', type: 'text' },
      { key: 'whatsappNumber', label: 'WhatsApp business number', type: 'text' },
      { key: 'address', label: 'Business address', type: 'textarea' },
      { key: 'gstin', label: 'GSTIN', type: 'text', hint: 'Printed on invoices' },
    ],
  },
  {
    title: 'Shipping & payments',
    fields: [
      { key: 'freeShippingThreshold', label: 'Free shipping above (₹)', type: 'money' },
      { key: 'shippingFee', label: 'Shipping fee (₹)', type: 'money' },
      { key: 'codEnabled', label: 'Cash on Delivery', type: 'bool' },
      { key: 'codFee', label: 'COD fee (₹)', type: 'money' },
      { key: 'codMaxOrderValue', label: 'COD max order value (₹)', type: 'money' },
      { key: 'returnWindowDays', label: 'Return window (days)', type: 'number' },
    ],
  },
  {
    title: 'Loyalty & referrals',
    fields: [
      { key: 'loyaltyEarnPer100', label: 'Points earned per ₹100', type: 'number' },
      { key: 'loyaltyPointValue', label: 'Value of 1 point (₹)', type: 'money' },
      { key: 'loyaltyMaxRedeemPercent', label: 'Max % of order payable with points', type: 'number' },
      { key: 'referralBonusPoints', label: 'Referral bonus (points, each side)', type: 'number' },
    ],
  },
  {
    title: 'Automation',
    fields: [
      { key: 'reviewAutoApprove', label: 'Publish reviews without moderation', type: 'bool' },
      { key: 'reviewRequestDelayDays', label: 'Ask for a review N days after delivery', type: 'number' },
      { key: 'trackingReminderHours', label: 'WhatsApp tracking reminder N hours after shipping', type: 'number' },
    ],
  },
];

const JOBS = [
  ['reminders', 'Process due reminders', 'Every minute'],
  ['expire-unpaid', 'Cancel unpaid online orders', 'Every 5 minutes'],
  ['abandoned-carts', 'Abandoned-cart reminders', 'Every 15 minutes'],
  ['back-in-stock', 'Back-in-stock alerts', 'Every 10 minutes'],
  ['admin-digest', 'Daily admin email digest', '9:00 AM'],
  ['cleanup', 'Clean expired sessions & codes', '3:30 AM'],
];

export default function SettingsPage() {
  const me = useAuth((s) => s.user);
  const isAdmin = me?.role === 'ADMIN';
  const { data } = useApi<{ settings: Record<string, any> }>('/admin/settings');
  const audit = useApi<any>(isAdmin ? '/admin/audit' : null, { limit: 25 });
  const [s, setS] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    if (data) setS(Object.fromEntries(Object.entries(data.settings).map(([k, v]) => [k, MONEY.includes(k) ? String(v / 100) : v])));
  }, [data]);

  if (!s) return <Loading />;

  const save = async () => {
    setSaving(true);
    try {
      const body = Object.fromEntries(
        Object.entries(s).map(([k, v]) => {
          if (MONEY.includes(k)) return [k, Math.round(Number(v) * 100)];
          const f = SECTIONS.flatMap((x) => x.fields).find((x) => x.key === k);
          if (f?.type === 'number') return [k, Number(v)];
          return [k, v];
        }),
      );
      await api('/admin/settings', { method: 'PUT', body });
      toast.success('Settings saved — live on the store within a minute');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description={isAdmin ? undefined : 'Only admins can change settings'}
        actions={
          isAdmin && (
            <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
              {saving ? <Spinner size={14} /> : 'Save settings'}
            </button>
          )
        }
      />
      <div className="grid gap-5 xl:grid-cols-2">
        {SECTIONS.map((sec) => (
          <Panel key={sec.title} title={sec.title}>
            <fieldset disabled={!isAdmin} className="grid gap-4 sm:grid-cols-2">
              {sec.fields.map((f) =>
                f.type === 'bool' ? (
                  <label key={f.key} className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
                    {f.label} <Toggle checked={Boolean(s[f.key])} onChange={(v) => setS({ ...s, [f.key]: v })} label={f.label} />
                  </label>
                ) : (
                  <label key={f.key} className={`block ${f.type === 'textarea' || f.key === 'announcement' ? 'sm:col-span-2' : ''}`}>
                    <span className="label">{f.label}</span>
                    {f.type === 'textarea' ? (
                      <textarea className="field" rows={2} value={s[f.key] ?? ''} onChange={(e) => setS({ ...s, [f.key]: e.target.value })} />
                    ) : (
                      <input
                        className="field"
                        inputMode={f.type === 'text' ? undefined : 'decimal'}
                        value={s[f.key] ?? ''}
                        onChange={(e) => setS({ ...s, [f.key]: f.type === 'text' ? e.target.value : e.target.value.replace(/[^\d.]/g, '') })}
                      />
                    )}
                    {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
                  </label>
                ),
              )}
            </fieldset>
          </Panel>
        ))}
        <Panel title="Social links">
          <fieldset disabled={!isAdmin} className="grid gap-4 sm:grid-cols-2">
            {['instagram', 'facebook', 'twitter', 'youtube'].map((k) => (
              <label key={k} className="block">
                <span className="label capitalize">{k}</span>
                <input className="field" value={s.social?.[k] ?? ''} onChange={(e) => setS({ ...s, social: { ...s.social, [k]: e.target.value } })} placeholder="https://" />
              </label>
            ))}
          </fieldset>
        </Panel>
        <Panel title="Background jobs" description="These run automatically on the API server. Run one now to test it." padded={false}>
          <Table head={['Job', 'Schedule (IST)', '']}>
            {JOBS.map(([id, label, when]) => (
              <tr key={id}>
                <td>{label}</td>
                <td className="text-muted">{when}</td>
                <td className="text-right">
                  <button
                    disabled={!isAdmin || running !== null}
                    onClick={async () => {
                      setRunning(id);
                      try {
                        const r = await api<{ ms: number }>(`/admin/jobs/${id}/run`, { method: 'POST' });
                        toast.success(`${label} finished in ${r.ms} ms`);
                      } catch (e) {
                        toast.error(errorMessage(e));
                      } finally {
                        setRunning(null);
                      }
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    {running === id ? <Spinner size={14} /> : <Play size={14} />} Run now
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>

      <Panel title="Integrations" className="mt-5" description="Credentials live in the API’s .env file — see README">
        <ul className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['Razorpay', 'RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET'],
            ['Gmail (SMTP)', 'GMAIL_USER, GMAIL_APP_PASSWORD'],
            ['SMS', 'SMS_PROVIDER = twilio | msg91 + its keys'],
            ['WhatsApp Cloud API', 'WHATSAPP_PROVIDER=meta, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
            ['Google sign-in', 'GOOGLE_CLIENT_ID (+ NEXT_PUBLIC_GOOGLE_CLIENT_ID on the storefront)'],
          ].map(([n, v]) => (
            <li key={n} className="rounded-[var(--radius-sm)] bg-tile/60 p-3">
              <div className="font-semibold">{n}</div>
              <div className="mt-0.5 font-mono text-[11px] text-muted">{v}</div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Until a provider is configured, its messages are logged as “not configured” and printed to the API console, so every flow still works in development.</p>
      </Panel>

      {isAdmin && audit.data && (
        <Panel title="Recent admin activity" className="mt-5" padded={false}>
          <Table head={['When', 'Who', 'Action', 'Target']}>
            {audit.data.items.map((a: any) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs text-muted">{dateTime(a.createdAt)}</td>
                <td>{a.userName ?? 'System'}</td>
                <td>{a.action.replace(/_/g, ' ')}</td>
                <td className="text-muted">
                  {a.entity}
                  {a.entityId ? ` · ${String(a.entityId).slice(0, 8)}` : ''}
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
    </div>
  );
}
