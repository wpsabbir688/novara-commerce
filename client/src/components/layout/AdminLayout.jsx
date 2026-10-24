import { useState } from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Package, FolderTree, Tag, Warehouse, ShoppingBag, Users, Ticket, Star, BarChart3, Settings, Shield, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/brands', label: 'Brands', icon: Tag },
  { to: '/admin/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/staff', label: 'Staff & permissions', icon: Shield },
];

export function AdminLayout() {
  const { user, loading, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (loading) return <div className="p-8 text-sm text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isStaff) return <div className="p-8"><p className="text-error">You do not have staff access.</p><Link to="/" className="text-brand">Back to store</Link></div>;

  const sidebar = (
    <nav className="space-y-1 p-3" aria-label="Admin navigation">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = location.pathname === item.to;
        return (
          <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? 'bg-brand text-white' : 'hover:bg-soft'}`}>
            <Icon size={16} /> {item.label}
          </Link>
        );
      })}
      <Link to="/" className="mt-4 block rounded-lg px-3 py-2 text-sm text-muted hover:bg-soft">← Back to storefront</Link>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-white lg:block">{sidebar}</aside>
      <div className="flex-1">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(!open)} aria-label="Admin menu" className="rounded-lg p-2 hover:bg-soft">{open ? <X size={20} /> : <Menu size={20} />}</button>
          <span className="font-bold">NOVARA Admin</span>
        </div>
        {open && <div className="border-b border-line lg:hidden">{sidebar}</div>}
        <main className="mx-auto max-w-6xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
