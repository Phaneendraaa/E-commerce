import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import './globals.css';
import { Providers } from '@/components/Providers';
import { serverApi } from '@/lib/server-api';
import type { StoreSettings } from '@/lib/types';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function generateMetadata(): Promise<Metadata> {
  const data = await serverApi<{ settings: StoreSettings }>('/cms/settings', { revalidate: 300 });
  const name = data?.settings.storeName ?? 'ShopNest';
  const tagline = data?.settings.tagline ?? 'Everything you love, delivered.';
  return {
    metadataBase: new URL(SITE),
    title: { default: `${name} — ${tagline}`, template: `%s | ${name}` },
    description: `Shop fashion, electronics, home and beauty at ${name}. Fast delivery, Cash on Delivery and easy returns across India.`,
    openGraph: { siteName: name, type: 'website', locale: 'en_IN' },
    twitter: { card: 'summary_large_image' },
    icons: { icon: '/favicon.svg' },
  };
}

export const viewport: Viewport = { themeColor: '#1b1446', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
