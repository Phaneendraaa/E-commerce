import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="text-center">
        <p className="font-display text-[120px] font-extrabold leading-none text-marigold md:text-[180px]" aria-hidden>
          404
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl">This page went out of stock</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">The link may be broken or the product was removed. Try searching, or head back to the store.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            Go to the store
          </Link>
          <Link href="/shop" className="btn btn-outline">
            Browse products
          </Link>
        </div>
      </div>
    </div>
  );
}
