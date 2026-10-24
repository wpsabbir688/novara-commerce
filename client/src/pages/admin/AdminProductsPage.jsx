import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../../services/apiClient.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatBDT } from '../../utils/currency.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export function AdminProductsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-products'], queryFn: () => get('/products?perPage=100&sort=newest&staff=true') });
  const remove = useMutation({
    mutationFn: (id) => del(`/products/${id}`),
    onSuccess: (d) => { toast.push(d.archived ? 'Product archived (has order history)' : 'Product deleted', 'success'); qc.invalidateQueries({ queryKey: ['admin-products'] }); },
    onError: (e) => toast.push(e.message, 'error'),
  });
  if (isLoading) return <Skeleton className="h-64" />;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link to="/admin/products/new"><Button>New product</Button></Link>
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-soft text-muted">
            <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
          </thead>
          <tbody>
            {(data?.products || []).map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.sku}</td>
                <td className="px-4 py-3">{formatBDT(p.salePrice ?? p.price)}</td>
                <td className="px-4 py-3">{p.status}</td>
                <td className="px-4 py-3">
                  <Link to={`/admin/products/${p.id}`} className="mr-3 text-brand">Edit</Link>
                  <button onClick={() => { if (confirm(`Delete ${p.name}? Products with order history are archived instead.`)) remove.mutate(p.id); }} className="text-error">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminProductEditorPage({ productId }) {
  const toast = useToast();
  const { data: cats } = useQuery({ queryKey: ['categories-all'], queryFn: () => get('/categories/all') });
  const { data: existing } = useQuery({ queryKey: ['admin-product', productId], queryFn: () => get(`/products/${productId}`), enabled: Boolean(productId && productId !== 'new') });
  const [form, setForm] = useState(null);
  const product = existing?.product;
  const values = form || (product ? { name: product.name, sku: product.sku, categoryId: product.categoryId, price: product.price, salePrice: product.salePrice || '', status: product.status, shortDescription: product.shortDescription || '', description: product.description || '', stock: 0 } : { name: '', sku: '', categoryId: '', price: '', salePrice: '', status: 'DRAFT', shortDescription: '', description: '', stock: 0 });
  const set = (k, v) => setForm({ ...values, [k]: v });
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...values, price: Number(values.price), salePrice: values.salePrice === '' ? null : Number(values.salePrice), stock: Number(values.stock) };
      if (productId === 'new') await post('/products', body);
      else await put(`/products/${productId}`, body);
      toast.push('Product saved', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };
  return (
    <div>
      <h1 className="text-2xl font-bold">{productId === 'new' ? 'New product' : 'Edit product'}</h1>
      <form onSubmit={save} className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-line bg-white p-6">
        <Input label="Name" value={values.name} onChange={(e) => set('name', e.target.value)} />
        <Input label="SKU" value={values.sku} onChange={(e) => set('sku', e.target.value)} />
        <label className="block"><span className="mb-1 block text-sm font-medium">Category</span>
          <select value={values.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm">
            <option value="">Select category</option>
            {(cats?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Price (poisha)" type="number" value={values.price} onChange={(e) => set('price', e.target.value)} />
          <Input label="Sale price (poisha, optional)" type="number" value={values.salePrice} onChange={(e) => set('salePrice', e.target.value)} />
        </div>
        <label className="block"><span className="mb-1 block text-sm font-medium">Status</span>
          <select value={values.status} onChange={(e) => set('status', e.target.value)} className="w-full rounded-xl border border-line px-3 py-2.5 text-sm">
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <Input label="Short description" value={values.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} />
        <Input label="Initial stock (new products)" type="number" value={values.stock} onChange={(e) => set('stock', e.target.value)} />
        <Button type="submit">Save product</Button>
        <p className="text-xs text-muted">Prices are stored in minor units (poisha). ৳100 = 10000 poisha.</p>
      </form>
    </div>
  );
}
