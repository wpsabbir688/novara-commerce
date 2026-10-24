import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../services/apiClient.js';
import { ProductGrid } from '../components/products/ProductCard.jsx';
import { Pagination, Skeleton } from '../components/ui/Skeleton.jsx';

export function ShopPage({ categorySlug }) {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 1);
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'relevance';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const inStock = params.get('inStock') === '1';

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === '' || value === null) next.delete(key);
    else next.set(key, value);
    next.delete('page');
    setParams(next);
  };

  const query = new URLSearchParams({ page, perPage: 20, sort });
  if (q) query.set('q', q);
  if (categorySlug) query.set('category', categorySlug);
  if (minPrice) query.set('minPrice', minPrice);
  if (maxPrice) query.set('maxPrice', maxPrice);
  if (inStock) query.set('inStock', 'true');

  const { data, isLoading } = useQuery({ queryKey: ['products', query.toString()], queryFn: () => get(`/products?${query}`) });
  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: () => get('/categories') });

  return (
    <div>
      <h1 className="text-2xl font-bold">{categorySlug ? (catData?.categories || []).find((c) => c.slug === categorySlug)?.name || 'Category' : 'Shop all products'}</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <label className="text-sm">Sort
          <select value={sort} onChange={(e) => set('sort', e.target.value)} className="ml-2 rounded-lg border border-line px-2 py-1.5 text-sm">
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="popularity">Popularity</option>
          </select>
        </label>
        <label className="text-sm">Min price (৳)
          <input type="number" min="0" value={minPrice ? String(Number(minPrice) / 100) : ''} onChange={(e) => set('minPrice', e.target.value ? String(Number(e.target.value) * 100) : '')} placeholder="0" className="ml-2 w-24 rounded-lg border border-line px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm">Max price (৳)
          <input type="number" min="0" value={maxPrice ? String(Number(maxPrice) / 100) : ''} onChange={(e) => set('maxPrice', e.target.value ? String(Number(e.target.value) * 100) : '')} placeholder="Any" className="ml-2 w-24 rounded-lg border border-line px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={inStock} onChange={(e) => set('inStock', e.target.checked ? '1' : '')} /> In stock only
        </label>
        {(q || minPrice || maxPrice || inStock || sort !== 'relevance') && (
          <button onClick={() => setParams({})} className="text-sm font-medium text-brand">Clear all filters</button>
        )}
      </div>

      {data && <p className="mt-4 text-sm text-muted">{data.total} product(s) found</p>}
      <div className="mt-4">
        {isLoading ? <Skeleton className="h-64" /> : <ProductGrid products={data?.products || []} />}
      </div>
      {data && <Pagination page={page} perPage={20} total={data.total} onPage={(p) => { const next = new URLSearchParams(params); next.set('page', String(p)); setParams(next); }} />}
    </div>
  );
}
