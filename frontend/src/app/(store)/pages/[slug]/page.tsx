import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { serverApi } from '@/lib/server-api';
import { date } from '@/lib/format';

type Params = Promise<{ slug: string }>;
interface Page {
  title: string;
  content: string;
  updatedAt: string;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const r = await serverApi<{ page: Page }>(`/cms/pages/${slug}`, { revalidate: 300 });
  return { title: r?.page.title ?? 'Page not found' };
}

export default async function CmsPage({ params }: { params: Params }) {
  const { slug } = await params;
  const r = await serverApi<{ page: Page }>(`/cms/pages/${slug}`, { revalidate: 300 });
  if (!r) notFound();
  return (
    <div className="container-x py-10">
      <article className="prose-store mx-auto max-w-[68ch]">
        <ReactMarkdown>{r.page.content}</ReactMarkdown>
        <p className="!mt-10 text-xs">Last updated {date(r.page.updatedAt)}</p>
      </article>
    </div>
  );
}
