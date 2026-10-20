import 'server-only';

const API_URL = process.env.API_URL || 'http://localhost:4000';

/**
 * Server-side fetch for public data (SSR / ISR). Cached briefly so catalog
 * pages stay fast while picking up admin changes within ~a minute.
 */
export async function serverApi<T = any>(path: string, opts: { revalidate?: number | false; tags?: string[] } = {}): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      next: { revalidate: opts.revalidate ?? 60, tags: opts.tags },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
