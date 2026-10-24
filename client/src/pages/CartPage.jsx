import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { formatBDT } from '../utils/currency.js';
import { Button } from '../components/ui/Button.jsx';

export function CartPage() {
  const { cart, updateQty, remove } = useCart();
  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg">Your cart is empty.</p>
        <Link to="/shop" className="mt-4 inline-block text-brand">Continue shopping →</Link>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-bold">Shopping cart</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {cart.items.map((item) => (
            <div key={item.id} className="flex gap-4 rounded-2xl border border-line bg-white p-4">
              {item.image && <img src={item.image} alt="" className="h-20 w-20 rounded-xl object-cover" />}
              <div className="flex-1">
                <Link to={`/product/${item.slug || ''}`} className="font-medium hover:text-brand">{item.name}</Link>
                {item.variantName && <p className="text-sm text-muted">{item.variantName}</p>}
                <p className="mt-1 text-sm">{formatBDT(item.unitPrice)} each</p>
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => updateQty(item.id, item.quantity - 1)} className="rounded-lg border border-line px-2 py-1 text-sm" aria-label="Decrease">−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, item.quantity + 1)} className="rounded-lg border border-line px-2 py-1 text-sm" aria-label="Increase">+</button>
                  <button onClick={() => remove(item.id)} aria-label="Remove" className="ml-auto p-1 text-muted hover:text-error"><Trash2 size={16} /></button>
                </div>
              </div>
              <p className="font-semibold">{formatBDT(item.lineTotal)}</p>
            </div>
          ))}
        </div>
        <div className="h-fit rounded-2xl border border-line bg-white p-5">
          <div className="flex justify-between"><span>Subtotal</span><strong>{formatBDT(cart.subtotal)}</strong></div>
          <p className="mt-2 text-sm text-muted">Shipping and discounts are calculated at checkout.</p>
          <Link to="/checkout"><Button className="mt-4 w-full">Proceed to checkout</Button></Link>
          <Link to="/shop" className="mt-2 block text-center text-sm text-brand">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
