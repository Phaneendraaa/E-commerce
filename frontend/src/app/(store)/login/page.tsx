'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, MessageCircle, Smartphone } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';
import { useSignedIn } from '@/lib/useSignedIn';
import { AuthShell } from '@/components/store/AuthShell';
import { GoogleButton } from '@/components/store/GoogleButton';
import { Spinner } from '@/components/ui';

function PasswordLogin() {
  const signedIn = useSignedIn();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const r = await api<{ user: User }>('/auth/login', { body: { identifier: f.get('identifier'), password: f.get('password') } });
      await signedIn(r.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <label className="block">
        <span className="label">Email or mobile number</span>
        <input name="identifier" className="field" autoComplete="username" required placeholder="you@example.com or 98765 43210" />
      </label>
      <label className="block">
        <span className="label flex justify-between">
          Password
          <Link href="/forgot-password" className="font-medium text-muted underline-offset-2 hover:underline">
            Forgot password?
          </Link>
        </span>
        <span className="relative block">
          <input name="password" type={show ? 'text' : 'password'} className="field pr-11" autoComplete="current-password" required />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <button disabled={busy} className="btn btn-primary btn-lg w-full">
        {busy ? <Spinner /> : 'Sign in'}
      </button>
    </form>
  );
}

function OtpLogin() {
  const signedIn = useSignedIn();
  const [target, setTarget] = useState('');
  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('WHATSAPP');
  const [stage, setStage] = useState<'enter' | 'verify'>('enter');
  const [isNew, setIsNew] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const isEmail = target.includes('@');

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ isNewUser: boolean; devCode?: string; channel: string }>('/auth/otp/send', { body: { target, channel: isEmail ? 'EMAIL' : channel } });
      setIsNew(r.isNewUser);
      setStage('verify');
      setCooldown(30);
      const t = setInterval(() => setCooldown((c) => (c <= 1 ? (clearInterval(t), 0) : c - 1)), 1000);
      toast.success(`Code sent via ${r.channel === 'WHATSAPP' ? 'WhatsApp' : r.channel === 'EMAIL' ? 'email' : 'SMS'}`);
      if (r.devCode) toast.info(`Development mode — your code is ${r.devCode}`, { duration: 15000 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ user: User; isNew: boolean }>('/auth/otp/verify', { body: { target, code, name: isNew ? name : undefined } });
      await signedIn(r.user, { isNew: r.isNew });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'enter') {
    return (
      <form onSubmit={send} className="space-y-4">
        <label className="block">
          <span className="label">Mobile number or email</span>
          <input value={target} onChange={(e) => setTarget(e.target.value)} className="field" required inputMode={isEmail ? 'email' : 'tel'} placeholder="98765 43210" autoComplete="tel" />
        </label>
        {!isEmail && (
          <fieldset>
            <legend className="label">Send code via</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['WHATSAPP', 'WhatsApp', MessageCircle],
                  ['SMS', 'SMS', Smartphone],
                ] as const
              ).map(([v, l, Icon]) => (
                <button type="button" key={v} onClick={() => setChannel(v)} aria-pressed={channel === v} className={`flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border text-sm font-semibold ${channel === v ? 'border-ink bg-ink text-white' : 'border-line'}`}>
                  <Icon size={16} /> {l}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <button disabled={busy || target.trim().length < 5} className="btn btn-primary btn-lg w-full">
          {busy ? <Spinner /> : 'Send code'}
        </button>
        <p className="text-xs text-muted">New here? We’ll create your account automatically.</p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-muted">
        Enter the 6-digit code sent to <b className="text-ink">{target}</b>.{' '}
        <button type="button" className="font-semibold text-ink underline underline-offset-2" onClick={() => (setStage('enter'), setCode(''))}>
          Change
        </button>
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="field !h-14 text-center font-display text-2xl tracking-[0.5em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-label="Verification code"
        required
      />
      {isNew && (
        <label className="block">
          <span className="label">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" required minLength={2} autoComplete="name" />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <button disabled={busy || code.length !== 6} className="btn btn-primary btn-lg w-full">
        {busy ? <Spinner /> : isNew ? 'Create account' : 'Verify & sign in'}
      </button>
      <button type="button" disabled={cooldown > 0 || busy} onClick={() => send()} className="w-full text-sm font-semibold text-muted disabled:opacity-60">
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
    </form>
  );
}

function LoginInner() {
  const [mode, setMode] = useState<'otp' | 'password'>('password');
  const signedIn = useSignedIn();
  const params = useSearchParams();
  return (
    <AuthShell title="Sign in" subtitle="Use your password or a one-time code — whichever is quicker.">
      <div className="mb-6 grid grid-cols-2 rounded-full bg-tile p-1 text-sm font-semibold" role="tablist">
        {(
          [
            ['password', 'Password'],
            ['otp', 'One-time code'],
          ] as const
        ).map(([m, l]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`h-10 rounded-full transition ${mode === m ? 'bg-surface shadow-sm' : 'text-muted'}`}>
            {l}
          </button>
        ))}
      </div>
      {mode === 'password' ? <PasswordLogin /> : <OtpLogin />}
      <GoogleButton onSignedIn={(u) => signedIn(u)} />
      <p className="mt-8 text-center text-sm text-muted">
        New to the store?{' '}
        <Link href={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-ink underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
