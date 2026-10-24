import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../../services/apiClient.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

function SimpleCrud({ title, listKey, listPath, createPath, fields, renderRow, headers }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: [listKey], queryFn: () => get(listPath) });
  const [form, setForm] = useState(Object.fromEntries(fields.map((f) => [f.key, ''])));
  const create = useMutation({
    mutationFn: (body) => post(createPath, body),
    onSuccess: () => { toast.push(`${title} saved`, 'success'); qc.invalidateQueries({ queryKey: [listKey] }); },
    onError: (e) => toast.push(e.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: (id) => del(`${createPath}/${id}`),
    onSuccess: () => { toast.push('Deleted', 'success'); qc.invalidateQueries({ queryKey: [listKey] }); },
    onError: (e) => toast.push(e.message, 'error'),
  });
  const items = data?.categories || data?.brands || [];
  if (isLoading) return <Skeleton className="h-48" />;
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="mt-6 grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
        {fields.map((f) => (
          <Input key={f.key} label={f.label} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
        ))}
        <div className="sm:col-span-2"><Button type="submit">Add {title.slice(0, -1).toLowerCase()}</Button></div>
      </form>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-soft text-muted"><tr>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}<th className="px-4 py-3">Actions</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                {renderRow(item)}
                <td className="px-4 py-3"><button onClick={() => remove.mutate(item.id)} className="text-error">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminCategoriesPage() {
  return (
    <SimpleCrud
      title="Categories"
      listKey="admin-categories"
      listPath="/categories/all"
      createPath="/categories"
      fields={[{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description' }]}
      headers={['Name', 'Slug', 'Active']}
      renderRow={(c) => (<><td className="px-4 py-3 font-medium">{c.name}</td><td className="px-4 py-3">{c.slug}</td><td className="px-4 py-3">{c.isActive ? 'Yes' : 'No'}</td></>)}
    />
  );
}

export function AdminBrandsPage() {
  return (
    <SimpleCrud
      title="Brands"
      listKey="admin-brands"
      listPath="/brands"
      createPath="/brands"
      fields={[{ key: 'name', label: 'Name' }, { key: 'logoUrl', label: 'Logo URL (optional)' }]}
      headers={['Name', 'Slug']}
      renderRow={(b) => (<><td className="px-4 py-3 font-medium">{b.name}</td><td className="px-4 py-3">{b.slug}</td></>)}
    />
  );
}

export function AdminCouponsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-coupons'], queryFn: () => get('/admin/coupons') });
  const [form, setForm] = useState({ code: '', discountType: 'PERCENTAGE', discountValue: 10, minOrderValue: 0 });
  const create = async (e) => {
    e.preventDefault();
    try {
      await post('/admin/coupons', { ...form, discountValue: Number(form.discountValue), minOrderValue: Number(form.minOrderValue) });
      toast.push('Coupon created', 'success');
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  return (
    <div>
      <h1 className="text-2xl font-bold">Coupons</h1>
      <form onSubmit={create} className="mt-6 grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
        <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <label className="block"><span className="mb-1 block text-sm font-medium">Type</span>
          <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm">
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed amount (poisha)</option>
          </select>
        </label>
        <Input label="Value" type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
        <Input label="Min order (poisha)" type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} />
        <div className="sm:col-span-2"><Button type="submit">Create coupon</Button></div>
      </form>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-soft text-muted"><tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Used</th><th className="px-4 py-3">Active</th></tr></thead>
          <tbody>
            {(data?.coupons || []).map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{c.code}</td>
                <td className="px-4 py-3">{c.discountType}</td>
                <td className="px-4 py-3">{c.discountValue}</td>
                <td className="px-4 py-3">{c._count?.redemptions ?? 0}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                <td className="px-4 py-3">{c.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminSettingsPage() {
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['admin-settings'], queryFn: () => get('/admin/settings') });
  const [announcement, setAnnouncement] = useState('');
  const [codEnabled, setCodEnabled] = useState(true);
  const save = async (e) => {
    e.preventDefault();
    try {
      await put('/admin/settings', { settings: { announcement: { text: announcement, dismissible: true, isActive: Boolean(announcement) }, cod: { enabled: codEnabled, minOrder: 0, maxOrder: null, districts: null } } });
      toast.push('Settings saved', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  return (
    <div>
      <h1 className="text-2xl font-bold">Store settings</h1>
      <form onSubmit={save} className="mt-6 max-w-xl space-y-4 rounded-2xl border border-line bg-white p-6">
        <Input label="Announcement bar text" value={announcement} placeholder={data?.settings?.announcement?.text || ''} onChange={(e) => setAnnouncement(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={codEnabled} onChange={(e) => setCodEnabled(e.target.checked)} /> Cash on Delivery enabled
        </label>
        <Button type="submit">Save settings</Button>
        <p className="text-xs text-muted">Changes to sensitive settings are recorded in the audit log.</p>
      </form>
    </div>
  );
}
