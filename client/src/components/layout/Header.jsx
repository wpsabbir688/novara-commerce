import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Heart, User, Menu, X, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';

export function Header() {
  const { user, logout, isStaff } = useAuth();
  const { count, setDrawerOpen } = useCart();
  const [q, setQ] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef(null);

  const { data: suggest } = useQuery({
    queryKey: ['suggest', q],
    queryFn: () => get(`/products/suggest?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: () => get('/categories') });
  const categories = catData?.categories || [];

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowSuggest(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setShowSuggest(false);
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <button className="rounded-lg p-2 hover:bg-soft lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link to="/" className="text-xl font-extrabold tracking-tight text-navy">
          NOVARA<span className="text-brand">.</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-4 lg:flex" aria-label="Categories">
          <Link to="/shop" className="text-sm font-medium hover:text-brand">Shop all</Link>
          {categories.slice(0, 5).map((c) => (
            <Link key={c.id} to={`/category/${c.slug}`} className="text-sm text-ink hover:text-brand">{c.name}</Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="relative ml-auto flex-1 max-w-md" ref={boxRef}>
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-full rounded-full border border-line bg-soft py-2 pl-10 pr-4 text-sm focus:border-brand focus:bg-white focus:outline-none"
          />
          {showSuggest && suggest && (suggest.products.length > 0 || suggest.categories.length > 0) && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
              {suggest.products.map((p) => (
                <button key={p.id} type="button" onClick={() => { setShowSuggest(false); navigate(`/product/${p.slug}`); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-soft">
                  {p.images?.[0] && <img src={p.images[0].url} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                  <span className="text-sm">{p.name}</span>
                </button>
              ))}
              {suggest.categories.map((c) => (
                <button key={c.id} type="button" onClick={() => { setShowSuggest(false); navigate(`/category/${c.slug}`); }} className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-soft">
                  in {c.name}
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="flex items-center gap-1">
          {user && (
            <Link to="/account/wishlist" className="rounded-full p-2 hover:bg-soft" aria-label="Wishlist">
              <Heart size={20} />
            </Link>
          )}
          <button onClick={() => setDrawerOpen(true)} className="relative rounded-full p-2 hover:bg-soft" aria-label="Cart">
            <ShoppingCart size={20} />
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{count}</span>}
          </button>
          <div className="relative">
            <button onClick={() => setAccountOpen(!accountOpen)} className="flex items-center gap-1 rounded-full p-2 hover:bg-soft" aria-label="Account menu">
              <User size={20} />
              <ChevronDown size={14} />
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
                {user ? (
                  <>
                    <Link to="/account" className="block px-4 py-2 text-sm hover:bg-soft" onClick={() => setAccountOpen(false)}>My account</Link>
                    <Link to="/account/orders" className="block px-4 py-2 text-sm hover:bg-soft" onClick={() => setAccountOpen(false)}>My orders</Link>
                    {isStaff && <Link to="/admin" className="block px-4 py-2 text-sm hover:bg-soft" onClick={() => setAccountOpen(false)}>Admin dashboard</Link>}
                    <button onClick={() => { logout(); setAccountOpen(false); }} className="block w-full px-4 py-2 text-left text-sm hover:bg-soft">Log out</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="block px-4 py-2 text-sm hover:bg-soft" onClick={() => setAccountOpen(false)}>Log in</Link>
                    <Link to="/register" className="block px-4 py-2 text-sm hover:bg-soft" onClick={() => setAccountOpen(false)}>Create account</Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-line px-4 py-3 lg:hidden" aria-label="Mobile categories">
          <Link to="/shop" className="block py-2 text-sm font-medium" onClick={() => setMenuOpen(false)}>Shop all</Link>
          {categories.map((c) => (
            <Link key={c.id} to={`/category/${c.slug}`} className="block py-2 text-sm" onClick={() => setMenuOpen(false)}>{c.name}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
