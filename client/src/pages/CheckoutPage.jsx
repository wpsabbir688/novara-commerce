import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { get, post } from '../services/apiClient.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatBDT } from '../utils/currency.js';
import { Input, Select } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';

const schema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(11),
  guestEmail: z.string().email().optional().or(z.literal('')),
  district: z.string().min(1),
  city: z.string().min(1),
  area: z.string().min(1),
  addressLine: z.string().min(3),
  notes: z.string().optional(),
  paymentMethod: z.enum(['COD', 'SSLCOMMERZ', 'BKASH', 'NAGAD']),
  couponCode: z.string().optional(),
});

export function CheckoutPage() {
  const { cart, refresh } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [summary, setSummary] = useState(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { customerName: user?.name || '', customerPhone: user?.phone?.replace('+880', '0') || '', district: 'Dhaka', city: 'Dhaka', area: '', addressLine: '', paymentMethod: 'COD' },
  });
  const couponCode = watch('couponCode');

  const { data: providers } = useQuery({ queryKey: ['providers'], queryFn: () => get('/payments/providers') });

  const recalc = async () => {
    try {
      const d = await post('/checkout/validate', { couponCode: couponCode || undefined });
      setSummary(d);
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };

  const onSubmit = async (values) => {
    if (cart.items.length === 0) return toast.push('Your cart is empty', 'error');
    setPlacing(true);
    try {
      const idempotencyKey = `ck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const d = await post('/checkout/orders', {
        ...values,
        guestEmail: user ? undefined : (values.guestEmail || undefined),
        couponCode: values.couponCode || undefined,
        idempotencyKey,
      });
      if (d.paymentInit?.error) {
        toast.push(`Order placed, but payment could not be started: ${d.paymentInit.error}`, 'error');
      }
      await refresh();
      navigate(`/order-success/${d.order.id}`, { state: { order: d.order } });
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (cart.items.length === 0) {
    return <div className="py-16 text-center"><p>Your cart is empty.</p><a href="/shop" className="text-brand">Continue shopping →</a></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Checkout</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">Delivery details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Full name" {...register('customerName')} error={errors.customerName?.message} />
              <Input label="Phone (01XXXXXXXXX)" {...register('customerPhone')} error={errors.customerPhone?.message} />
              {!user && <Input label="Email (for order updates)" {...register('guestEmail')} error={errors.guestEmail?.message} />}
              <Input label="District" {...register('district')} error={errors.district?.message} />
              <Input label="City" {...register('city')} error={errors.city?.message} />
              <Input label="Area" {...register('area')} error={errors.area?.message} />
              <div className="sm:col-span-2">
                <Input label="Full address" {...register('addressLine')} error={errors.addressLine?.message} />
              </div>
              <div className="sm:col-span-2">
                <Input label="Order notes (optional)" {...register('notes')} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">Payment method</h2>
            <div className="mt-3 space-y-2">
              {(providers?.providers || [{ id: 'cod', name: 'Cash on Delivery', enabled: true }]).map((p) => (
                <label key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${!p.enabled ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="radio" value={p.method || p.id.toUpperCase()} {...register('paymentMethod')} disabled={!p.enabled} />
                  <span className="text-sm font-medium">{p.name}</span>
                  {!p.enabled && <span className="text-xs text-muted">Not configured — unavailable</span>}
                  {p.id === 'cod' && <span className="text-xs text-success">Pay when your order arrives</span>}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="h-fit rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Order summary</h2>
          <div className="mt-3 space-y-1 text-sm">
            {cart.items.map((i) => (
              <div key={i.id} className="flex justify-between"><span>{i.name} × {i.quantity}</span><span>{formatBDT(i.lineTotal)}</span></div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input placeholder="Coupon code" {...register('couponCode')} className="flex-1 rounded-xl border border-line px-3 py-2 text-sm" />
            <Button type="button" variant="outline" onClick={recalc}>Apply</Button>
          </div>
          <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatBDT(summary?.subtotal ?? cart.subtotal)}</span></div>
            {summary?.discount > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>−{formatBDT(summary.discount)}</span></div>}
            <div className="flex justify-between"><span>Shipping (estimated)</span><span>{summary ? formatBDT(summary.shippingFee) : 'Calculated at order'}</span></div>
            <div className="flex justify-between border-t border-line pt-2 font-bold"><span>Total</span><span>{formatBDT(summary?.grandTotal ?? cart.subtotal)}</span></div>
          </div>
          <p className="mt-2 text-xs text-muted">Totals are recalculated and verified by the server before your order is placed. Prices shown here are estimates until then.</p>
          <Button type="submit" className="mt-4 w-full" disabled={placing}>{placing ? 'Placing order…' : 'Place order'}</Button>
        </div>
      </form>
    </div>
  );
}
