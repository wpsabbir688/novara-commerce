import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { get } from '../services/apiClient.js';
import { formatBDT } from '../utils/currency.js';
import { useAuth } from '../context/AuthContext.jsx';

export function OrderSuccessPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['order-success', id],
    queryFn: () => get(user ? `/orders/mine/${id}` : `/orders/mine/${id}`).catch(() => null),
    enabled: Boolean(user),
  });
  const order = location.state?.order || data?.order;

  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <CheckCircle2 size={56} className="mx-auto text-success" />
      <h1 className="mt-4 text-2xl font-bold">Order placed successfully</h1>
      <p className="mt-2 text-muted">Thank you for shopping with NOVARA Commerce.</p>
      {order ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-left">
          <div className="space-y-1 text-sm">
            <p><strong>Order number:</strong> {order.orderNumber}</p>
            <p><strong>Status:</strong> {order.status}</p>
            <p><strong>Payment:</strong> {order.paymentMethod} — {order.paymentStatus}</p>
            {order.paymentMethod === 'COD' && <p className="text-muted">You will pay in cash when your order is delivered. Payment is recorded only after our delivery team confirms collection.</p>}
            <p><strong>Total:</strong> {formatBDT(order.grandTotal)}</p>
            <p><strong>Deliver to:</strong> {order.customerName}, {order.addressLine}, {order.area}, {order.city}, {order.district}</p>
          </div>
          <div className="mt-4 border-t border-line pt-3 text-sm">
            {order.items?.map((i) => (
              <div key={i.id} className="flex justify-between py-1"><span>{i.productName} × {i.quantity}</span><span>{formatBDT(i.lineTotal)}</span></div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Your order was placed. You can view it in your account once you log in.</p>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/shop" className="rounded-xl bg-navy px-5 py-2.5 text-sm font-medium text-white">Continue shopping</Link>
        {user && <Link to="/account/orders" className="rounded-xl border border-line px-5 py-2.5 text-sm font-medium">View my orders</Link>}
      </div>
    </div>
  );
}
