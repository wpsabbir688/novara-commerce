import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put } from '../../services/apiClient.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatBDT } from '../../utils/currency.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export function AdminInventoryPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-inventory'], queryFn: () => get('/admin/inventory?perPage=100') });
  const [adjust, setAdjust] = useState({ productId: '', delta: 0, reason: '' });
  const doAdjust = async (e) => {
    e.preventDefault();
    try {
      await post('/admin/inventory/adjust', { ...adjust, delta: Number(adjust.delta) });
      toast.push('Stock adjusted', 'success');
      qc.invalidateQueries({ queryKey: ['admin-inventory'] });
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  if (isLoading) return <Skeleton className="h-64" />;
  return (
    <div>
      <h1 className="text-2xl font-bold">Inventory</h1>
      <form onSubmit={doAdjust} className="mt-6 grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-3">
        <label className="block text-sm font-medium">Product
          <select value={adjust.productId} onChange={(e) => setAdjust({ ...adjust, productId: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm">
            <option value="">Select product</option>
            {(data?.inventory || []).map((r) => <option key={r.id} value={r.product.id}>{r.product.name}</option>)}
          </select>
        </label>
        <Input label="Adjustment (+/-)" type="number" value={adjust.delta} onChange={(e) => setAdjust({ ...adjust, delta: e.target.value })} />
        <Input label="Reason" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
        <div className="sm:col-span-3"><Button type="submit">Adjust stock</Button></div>
      </form>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-soft text-muted"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Variant</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Reserved</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Threshold</th></tr></thead>
          <tbody>
            {(data?.inventory || []).map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{r.product.name}</td>
                <td className="px-4 py-3">{r.variant?.name || '—'}</td>
                <td className="px-4 py-3">{r.quantity}</td>
                <td className="px-4 py-3">{r.reserved}</td>
                <td className="px-4 py-3 font-medium">{r.quantity - r.reserved}</td>
                <td className="px-4 py-3">{r.lowThreshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminOrdersPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-orders'], queryFn: () => get('/orders?perPage=50') });
  if (isLoading) return <Skeleton className="h-64" />;
  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-soft text-muted"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Total</th></tr></thead>
          <tbody>
            {(data?.orders || []).map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-4 py-3"><Link to={`/admin/orders/${o.id}`} className="font-medium text-brand">{o.orderNumber}</Link></td>
                <td className="px-4 py-3">{o.customerName}</td>
                <td className="px-4 py-3">{o.status}</td>
                <td className="px-4 py-3">{o.paymentMethod} ({o.paymentStatus})</td>
                <td className="px-4 py-3">{formatBDT(o.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminOrderDetailsPage({ orderId }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-order', orderId], queryFn: () => get(`/orders/${orderId}`) });
  const [status, setStatus] = useState('');
  const [tracking, setTracking] = useState('');
  const change = async (e) => {
    e.preventDefault();
    try {
      await post(`/orders/${orderId}/status`, { status, trackingNumber: tracking || undefined });
      toast.push('Order status updated', 'success');
      qc.invalidateQueries({ queryKey: ['admin-order', orderId] });
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  const collect = async () => {
    try {
      await post(`/payments/orders/${orderId}/cod-collect`, {});
      toast.push('COD collection recorded', 'success');
      qc.invalidateQueries({ queryKey: ['admin-order', orderId] });
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  if (isLoading) return <Skeleton className="h-64" />;
  const o = data?.order;
  if (!o) return <p>Order not found.</p>;
  return (
    <div>
      <h1 className="text-2xl font-bold">{o.orderNumber}</h1>
      <p className="mt-1 text-sm text-muted">{o.customerName} · {o.customerPhone} · {o.addressLine}, {o.area}, {o.city}, {o.district}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Items</h2>
          <div className="mt-3 space-y-1 text-sm">
            {o.items.map((i) => (
              <div key={i.id} className="flex justify-between"><span>{i.productName}{i.variantName ? ` (${i.variantName})` : ''} × {i.quantity}</span><span>{formatBDT(i.lineTotal)}</span></div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatBDT(o.subtotal)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>−{formatBDT(o.discountTotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{formatBDT(o.shippingFee)}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span>{formatBDT(o.grandTotal)}</span></div>
            <div className="flex justify-between"><span>Payment</span><span>{o.paymentMethod} ({o.paymentStatus})</span></div>
          </div>
        </div>
        <div className="space-y-6">
          <form onSubmit={change} className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">Update status</h2>
            <p className="text-sm text-muted">Current: {o.status} · Only valid transitions are accepted by the server.</p>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-3 w-full rounded-xl border border-line px-3 py-2.5 text-sm">
              <option value="">Select new status</option>
              {['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Input label="Tracking number (for SHIPPED)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
            <Button type="submit" className="mt-3" disabled={!status}>Update status</Button>
          </form>
          {o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID' && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-semibold">COD collection</h2>
              <p className="mt-1 text-sm text-muted">Mark paid only after the delivery team confirms cash collection.</p>
              <Button className="mt-3" onClick={collect}>Record COD collection</Button>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">Status timeline</h2>
            <ol className="mt-2 space-y-1 text-sm text-muted">
              {o.statusHistory.map((h) => (
                <li key={h.id}>{new Date(h.createdAt).toLocaleString('en-GB')} — {h.fromStatus || '—'} → {h.toStatus}{h.reason ? ` (${h.reason})` : ''}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCustomersPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-customers'], queryFn: () => get('/admin/users?perPage=50') });
  if (isLoading) return <Skeleton className="h-64" />;
  return (
    <div>
      <h1 className="text-2xl font-bold">Customers</h1>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-soft text-muted"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Active</th></tr></thead>
          <tbody>
            {(data?.users || []).map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3"><Link to={`/admin/customers/${u.id}`} className="font-medium text-brand">{u.name}</Link></td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.phone || '—'}</td>
                <td className="px-4 py-3">{u.roles.map((r) => r.role.name).join(', ')}</td>
                <td className="px-4 py-3">{u._count?.orders ?? 0}</td>
                <td className="px-4 py-3">{u.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminCustomerDetailsPage({ userId }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-customer', userId], queryFn: () => get(`/admin/users/${userId}`) });
  const toggle = async () => {
    try {
      await post(`/admin/users/${userId}/status`, { isActive: !data.user.isActive });
      toast.push('Account status updated', 'success');
      qc.invalidateQueries({ queryKey: ['admin-customer', userId] });
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  if (isLoading) return <Skeleton className="h-64" />;
  const u = data?.user;
  if (!u) return <p>User not found.</p>;
  const spent = u.orders.reduce((s, o) => s + (o.status === 'CANCELLED' || o.status === 'REFUNDED' ? 0 : o.grandTotal), 0);
  return (
    <div>
      <h1 className="text-2xl font-bold">{u.name}</h1>
      <p className="text-sm text-muted">{u.email} · {u.phone || 'No phone'} · Roles: {u.roles.map((r) => r.role.name).join(', ')}</p>
      <p className="mt-2 text-sm">Total spent (excluding cancelled/refunded): <strong>{formatBDT(spent)}</strong> · Orders: {u.orders.length}</p>
      <Button variant="outline" className="mt-4" onClick={toggle}>{u.isActive ? 'Suspend account' : 'Reactivate account'}</Button>
      <h2 className="mt-8 font-semibold">Order history</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {u.orders.map((o) => (
          <li key={o.id} className="rounded-xl border border-line bg-white p-3"><Link to={`/admin/orders/${o.id}`} className="font-medium text-brand">{o.orderNumber}</Link> · {o.status} · {formatBDT(o.grandTotal)}</li>
        ))}
      </ul>
    </div>
  );
}

export function AdminReviewsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-reviews'], queryFn: () => get('/reviews/pending') });
  const moderate = async (id, action) => {
    try {
      await post(`/reviews/${id}/moderate`, { action });
      toast.push(`Review ${action}`, 'success');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  return (
    <div>
      <h1 className="text-2xl font-bold">Review moderation</h1>
      <p className="text-sm text-muted">Reviews appear publicly only after approval.</p>
      <div className="mt-6 space-y-3">
        {(data?.reviews || []).map((r) => (
          <div key={r.id} className="rounded-2xl border border-line bg-white p-4">
            <p className="font-medium">{r.product.name} — {r.rating}/5 by {r.user.name}</p>
            {r.title && <p className="mt-1">{r.title}</p>}
            {r.body && <p className="mt-1 text-sm text-muted">{r.body}</p>}
            <div className="mt-3 flex gap-2">
              <Button onClick={() => moderate(r.id, 'approved')}>Approve</Button>
              <Button variant="danger" onClick={() => moderate(r.id, 'rejected')}>Reject</Button>
            </div>
          </div>
        ))}
        {data?.reviews?.length === 0 && <p className="text-muted">No pending reviews.</p>}
      </div>
    </div>
  );
}

export function AdminReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Reports & exports</h1>
      <p className="text-sm text-muted">Exports are permission-gated and exclude unnecessary personal data.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href="/api/v1/admin/reports/orders.csv" className="rounded-xl bg-navy px-5 py-2.5 text-sm font-medium text-white">Download orders CSV</a>
        <a href="/api/v1/admin/reports/products.csv" className="rounded-xl bg-navy px-5 py-2.5 text-sm font-medium text-white">Download products CSV</a>
        <a href="/api/v1/admin/reports/inventory.csv" className="rounded-xl bg-navy px-5 py-2.5 text-sm font-medium text-white">Download inventory CSV</a>
      </div>
      <p className="mt-4 text-xs text-muted">Note: CSV downloads use your session cookie; open them while logged in as staff.</p>
    </div>
  );
}

export function AdminStaffPage() {
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['admin-staff'], queryFn: () => get('/admin/users?perPage=100') });
  const [role, setRole] = useState('ORDER_MANAGER');
  const assign = async (userId) => {
    try {
      await post(`/admin/users/${userId}/roles`, { role });
      toast.push('Role assigned', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  return (
    <div>
      <h1 className="text-2xl font-bold">Staff & permissions</h1>
      <p className="text-sm text-muted">Assign roles to staff accounts. Permissions are enforced server-side on every route.</p>
      <label className="mt-6 block max-w-xs text-sm font-medium">Role to assign
        <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm">
          {['SUPER_ADMIN', 'STORE_MANAGER', 'PRODUCT_MANAGER', 'ORDER_MANAGER', 'SUPPORT_AGENT', 'CUSTOMER'].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <div className="mt-6 space-y-2">
        {(data?.users || []).map((u) => (
          <div key={u.id} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 text-sm">
            <span><strong>{u.name}</strong> · {u.email} · {u.roles.map((r) => r.role.name).join(', ')}</span>
            <Button variant="outline" onClick={() => assign(u.id)}>Assign {role}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
