import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Truck, ShieldCheck, RefreshCcw, Headset } from 'lucide-react';
import { get } from '../services/apiClient.js';
import { ProductGrid } from '../components/products/ProductCard.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';

export function HomePage() {
  const { data, isLoading } = useQuery({ queryKey: ['homepage'], queryFn: () => get('/public/homepage') });
  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: () => get('/categories') });
  const hero = data?.sections?.find((s) => s.key === 'hero')?.banners?.[0];

  return (
    <div>
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-navy text-white">
        <div className="grid items-center gap-6 p-6 sm:grid-cols-2 sm:p-10">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{hero?.title || 'Premium shopping, made for Bangladesh'}</h1>
            <p className="mt-3 text-white/80">{hero?.subtitle || 'Electronics, fashion, home and more — with Cash on Delivery nationwide.'}</p>
            <Link to="/shop" className="mt-6 inline-block rounded-xl bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark">
              {hero?.ctaLabel || 'Shop now'}
            </Link>
          </div>
          {hero?.imageUrl && <img src={hero.imageUrl} alt="" className="h-64 w-full rounded-2xl object-cover sm:h-80" />}
        </div>
      </section>

      {/* Categories */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">Shop by category</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {(catData?.categories || []).map((c) => (
            <Link key={c.id} to={`/category/${c.slug}`} className="overflow-hidden rounded-2xl border border-line bg-white hover:shadow-md">
              {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" />}
              <p className="p-2 text-center text-sm font-medium">{c.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">Featured products</h2>
        <div className="mt-4">
          {isLoading ? <Skeleton className="h-64" /> : <ProductGrid products={data?.featured || []} />}
        </div>
      </section>

      {/* New arrivals */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">New arrivals</h2>
        <div className="mt-4">
          {isLoading ? <Skeleton className="h-64" /> : <ProductGrid products={data?.newArrivals || []} />}
        </div>
      </section>

      {/* Best sellers (from real order data; empty until orders exist) */}
      {data?.bestSellers?.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Best sellers</h2>
          <div className="mt-4"><ProductGrid products={data.bestSellers} /></div>
        </section>
      )}

      {/* Deals */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">Discounted products</h2>
        <div className="mt-4">
          {isLoading ? <Skeleton className="h-64" /> : <ProductGrid products={data?.deals || []} />}
        </div>
      </section>

      {/* Trust strip */}
      <section className="mt-12 grid gap-4 rounded-3xl border border-line bg-soft p-6 sm:grid-cols-4">
        {[
          { icon: Truck, title: 'Nationwide delivery', text: 'Delivery fees shown at checkout' },
          { icon: ShieldCheck, title: 'Cash on Delivery', text: 'Pay when your order arrives' },
          { icon: RefreshCcw, title: 'Easy returns', text: 'Return workflow in your account' },
          { icon: Headset, title: 'Support', text: 'Help from real people, not bots' },
        ].map((f) => (
          <div key={f.title} className="flex gap-3">
            <f.icon className="shrink-0 text-brand" />
            <div><p className="font-semibold">{f.title}</p><p className="text-sm text-muted">{f.text}</p></div>
          </div>
        ))}
      </section>
    </div>
  );
}
