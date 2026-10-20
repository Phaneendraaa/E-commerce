'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: any;
  }
}

/** Google Identity Services button. Renders nothing unless NEXT_PUBLIC_GOOGLE_CLIENT_ID is set. */
export function GoogleButton({ onSignedIn }: { onSignedIn: (u: User, isNew?: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    const init = () => {
      window.google?.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            const r = await api<{ user: User }>('/auth/google', { body: { credential: resp.credential } });
            onSignedIn(r.user);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        },
      });
      if (ref.current) window.google?.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', shape: 'pill', width: 320, text: 'continue_with' });
    };
    if (window.google?.accounts) return init();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [onSignedIn]);

  if (!CLIENT_ID) return null;
  return (
    <>
      <div className="my-6 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <div ref={ref} className="flex justify-center" />
    </>
  );
}
