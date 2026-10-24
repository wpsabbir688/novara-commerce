import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatBDT } from '../utils/currency.js';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone?.replace('+880', '0') || '');
  const save = async (e) => {
    e.preventDefault();
    try {
      const d = await put('/account/profile', { name, phone: phone || undefined });
      setUser({ ...user, ...d.user });
      toast.push('Profile updated', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  return (
    <form onSubmit={save} className="max-w-md space-y-4 rounded-2xl border border-line bg-white p-6">
      <p className="text-sm text-muted">{user?.email} · Roles: {(user?.roles || []).join(', ')}</p>
      <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Button type="submit">Save changes</Button>
    </form>
  );
}

export function OrderHistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ['my-orders'], queryFn: () => get('/orders/mine?perPage=50') });
  if (isLoading) return <Skeleton className="h-48" />;
  if (!data?.orders?.length) return <p className="text-muted">You have no orders yet. <Link to="/shop" className="text-brand">Start shopping →</Link></p>;
  return (
    <div className="space-y-3">
      {data.orders.map((o) => (
        <Link key={o.id} to={`/account/orders/${o.id}`} className="block rounded-2xl border border-line bg-white p-4 hover:shadow-md">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">{o.orderNumber}</span>
            <span className="text-sm">{formatBDT(o.grandTotal)}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{o.status} · Payment: {o.paymentMethod} ({o.paymentStatus}) · {new Date(o.createdAt).toLocaleDateString('en-GB')}</p>
        </Link>
      ))}
    </div>
  );
}

export function OrderDetailPage({ orderId }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['my-order', orderId], queryFn: () => get(`/orders/mine/${orderId}`) });
  const cancel = useMutation({
    mutationFn: () => post(`/orders/mine/${orderId}/cancel`, {}),
    onSuccess: () => { toast.push('Order cancelled', 'success'); qc.invalidateQueries({ queryKey: ['my-order', orderId] }); },
    onError: (e) => toast.push(e.message, 'error'),
  });
  if (isLoading) return <Skeleton className="h-48" />;
  const o = data?.order;
  if (!o) return <p>Order not found.</p>;
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="text-lg font-bold">{o.orderNumber}</h2>
        <span className="rounded-full bg-soft px-3 py-1 text-sm">{o.status}</span>
      </div>
      <p className="mt-2 text-sm text-muted">Payment: {o.paymentMethod} — {o.paymentStatus} · Total: {formatBDT(o.grandTotal)}</p>
      <div className="mt-4 space-y-1 text-sm">
        {o.items.map((i) => (
          <div key={i.id} className="flex justify-between"><span>{i.productName}{i.variantName ? ` (${i.variantName})` : ''} × {i.quantity}</span><span>{formatBDT(i.lineTotal)}</span></div>
        ))}
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <p className="font-medium">Status timeline</p>
        <ol className="mt-2 space-y-1 text-sm text-muted">
          {o.statusHistory.map((h) => (
            <li key={h.id}>{new Date(h.createdAt).toLocaleString('en-GB')} — {h.fromStatus || '—'} → {h.toStatus}{h.reason ? ` (${h.reason})` : ''}</li>
          ))}
        </ol>
      </div>
      {['PENDING', 'CONFIRMED'].includes(o.status) && (
        <Button variant="danger" className="mt-4" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel order</Button>
      )}
      <p className="mt-4 text-sm"><Link to="/account/orders" className="text-brand">← Back to orders</Link></p>
    </div>
  );
}

export function AddressesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['addresses'], queryFn: () => get('/account/addresses') });
  const [form, setForm] = useState({ label: 'Home', fullName: '', phone: '', district: 'Dhaka', city: 'Dhaka', area: '', addressLine: '' });
  const add = async (e) => {
    e.preventDefault();
    try {
      await post('/account/addresses', form);
      toast.push('Address saved', 'success');
      qc.invalidateQueries({ queryKey: ['addresses'] });
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  const remove = async (id) => {
    await del(`/account/addresses/${id}`);
    qc.invalidateQueries({ queryKey: ['addresses'] });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={add} className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Add address</h2>
        <Input label="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <Input label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
        <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <Input label="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        <Input label="Full address" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} />
        <Button type="submit">Save address</Button>
      </form>
      <div className="space-y-3">
        {(data?.addresses || []).map((a) => (
          <div key={a.id} className="rounded-2xl border border-line bg-white p-4">
            <p className="font-medium">{a.label} — {a.fullName}</p>
            <p className="text-sm text-muted">{a.addressLine}, {a.area}, {a.city}, {a.district} · {a.phone}</p>
            <button onClick={() => remove(a.id)} className="mt-2 text-sm text-error">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WishlistPage() {
  const { data } = useQuery({ queryKey: ['wishlist'], queryFn: () => get('/wishlist') });
  if (!data?.items?.length) return <p className="text-muted">Your wishlist is empty.</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {data.items.map((i) => (
        <Link key={i.id} to={`/product/${i.product.slug}`} className="overflow-hidden rounded-2xl border border-line bg-white hover:shadow-md">
          {i.product.images?.[0] && <img src={i.product.images[0].url} alt="" className="aspect-square w-full object-cover" />}
          <p className="p-3 text-sm font-medium">{i.product.name}</p>
        </Link>
      ))}
    </div>
  );
}
