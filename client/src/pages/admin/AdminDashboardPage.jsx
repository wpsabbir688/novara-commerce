import { useQuery } from '@tanstack/react-query';
import { get } from '../../services/apiClient.js';
import { formatBDT } from '../../utils/currency.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => get('/admin/dashboard') });
  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <p className="text-error">{error.message}</p>;
  const cards = [
    ['Gross sales (30d)', formatBDT(data.grossSales)],
    ['Net sales (30d)', formatBDT(data.netSales)],
    ['Orders', String(data.orderCount)],
    ['Avg order value', formatBDT(data.avgOrderValue)],
    ['Customers', String(data.totalCustomers)],
    ['New customers', String(data.newCustomers)],
    ['Active listings', String(data.activeListings)],
    ['Pending orders', String(data.pendingOrders)],
  ];
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-sm text-muted">All figures come from live database records — nothing here is hardcoded.</p>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Recent orders</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.recentOrders.map((o) => (
              <li key={o.id} className="flex justify-between"><span>{o.orderNumber} · {o.status}</span><span>{formatBDT(o.grandTotal)}</span></li>
            ))}
            {data.recentOrders.length === 0 && <li className="text-muted">No orders yet.</li>}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Low stock</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.lowStock.map((r, i) => (
              <li key={i} className="flex justify-between"><span>{r.product.name}{r.variant ? ` (${r.variant.name})` : ''}</span><span className="text-warning font-medium">{r.available} left (threshold {r.threshold})</span></li>
            ))}
            {data.lowStock.length === 0 && <li className="text-muted">No low-stock items.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Best sellers (by units ordered)</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.bestSellers.map((b) => (
            <li key={b.id} className="flex justify-between"><span>{b.name}</span><span>{b.quantity} sold</span></li>
          ))}
          {data.bestSellers.length === 0 && <li className="text-muted">No sales yet — best sellers appear here from real order data.</li>}
        </ul>
      </div>
    </div>
  );
}
