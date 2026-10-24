import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../services/apiClient.js';

export function Footer() {
  const { data } = useQuery({ queryKey: ['store-settings'], queryFn: () => get('/public/store') });
  const store = data?.settings?.store || {};
  return (
    <footer className="mt-16 border-t border-line bg-soft">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-navy">NOVARA<span className="text-brand">.</span></p>
          <p className="mt-2 text-sm text-muted">{store.tagline || 'Premium shopping, made for Bangladesh.'}</p>
        </div>
        <div>
          <p className="font-semibold">Shop</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li><Link to="/shop" className="hover:text-brand">All products</Link></li>
            <li><Link to="/search?q=" className="hover:text-brand">Search</Link></li>
            <li><Link to="/cart" className="hover:text-brand">Cart</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Help</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>Cash on Delivery available nationwide</li>
            <li>Delivery fees shown at checkout — never hidden</li>
            {store.email && <li>{store.email}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {store.name || 'NOVARA Commerce'}. Prices in BDT (৳).
      </div>
    </footer>
  );
}
