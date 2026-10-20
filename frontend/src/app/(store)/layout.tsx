import { serverApi } from '@/lib/server-api';
import type { Category, StoreSettings } from '@/lib/types';
import { Header } from '@/components/store/Header';
import { Footer } from '@/components/store/Footer';
import { CartDrawer } from '@/components/store/CartDrawer';

const fallback: StoreSettings = {
  storeName: 'ShopNest',
  tagline: 'Everything you love, delivered.',
  supportEmail: 'support@shopnest.dev',
  supportPhone: '',
  whatsappNumber: '',
  address: '',
  freeShippingThreshold: 49900,
  shippingFee: 4900,
  codEnabled: true,
  codFee: 3900,
  loyaltyPointValue: 100,
  loyaltyEarnPer100: 1,
  returnWindowDays: 7,
  social: {},
  announcement: '',
};

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [s, c] = await Promise.all([serverApi<{ settings: StoreSettings }>('/cms/settings'), serverApi<{ categories: Category[] }>('/categories')]);
  const settings = s?.settings ?? fallback;
  const categories = c?.categories ?? [];
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header settings={settings} categories={categories} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer settings={settings} categories={categories} />
      <CartDrawer />
    </>
  );
}
