import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { to: '/account', label: 'Profile' },
  { to: '/account/orders', label: 'My orders' },
  { to: '/account/addresses', label: 'Addresses' },
  { to: '/account/wishlist', label: 'Wishlist' },
];

export function AccountLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8 text-sm text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div>
      <h1 className="text-2xl font-bold">My account</h1>
      <nav className="mt-4 flex gap-2 border-b border-line pb-2" aria-label="Account sections">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} className={`rounded-lg px-3 py-2 text-sm ${location.pathname === t.to ? 'bg-navy text-white' : 'hover:bg-soft'}`}>{t.label}</Link>
        ))}
      </nav>
      <div className="mt-6"><Outlet /></div>
    </div>
  );
}
