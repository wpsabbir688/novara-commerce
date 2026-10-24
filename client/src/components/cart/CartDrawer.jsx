import { Link } from 'react-router-dom';
import { X, Trash2 } from 'lucide-react';
import { useCart } from '../../context/CartContext.jsx';
import { formatBDT } from '../../utils/currency.js';
import { Button } from '../ui/Button.jsx';

export function CartDrawer() {
  const { cart, drawerOpen, setDrawerOpen, updateQty, remove } = useCart();
  if (!drawerOpen) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-navy/50" onClick={() => setDrawerOpen(false)} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl" role="dialog" aria-label="Shopping cart">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-semibold">Your cart ({cart.items.length})</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close cart" className="rounded-lg p-1 hover:bg-soft"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {cart.items.length === 0 && <p className="py-10 text-center text-muted">Your cart is empty.</p>}
          {cart.items.map((item) => (
            <div key={item.id} className="mb-3 flex gap-3 rounded-2xl border border-line p-3">
              {item.image && <img src={item.image} alt="" className="h-16 w-16 rounded-xl object-cover" />}
              <div className="flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                {item.variantName && <p className="text-xs text-muted">{item.variantName}</p>}
                <p className="mt-1 text-sm font-semibold">{formatBDT(item.lineTotal)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => updateQty(item.id, item.quantity - 1)} className="rounded-lg border border-line px-2 py-1 text-sm" aria-label="Decrease quantity">−</button>
                  <span className="text-sm">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, item.quantity + 1)} className="rounded-lg border border-line px-2 py-1 text-sm" aria-label="Increase quantity">+</button>
                  <button onClick={() => remove(item.id)} aria-label="Remove item" className="ml-auto rounded-lg p-1 text-muted hover:text-error"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-line p-4">
          <div className="mb-3 flex justify-between text-sm"><span>Subtotal</span><strong>{formatBDT(cart.subtotal)}</strong></div>
          <p className="mb-3 text-xs text-muted">Shipping and discounts are calculated at checkout.</p>
          <Link to="/checkout" onClick={() => setDrawerOpen(false)}>
            <Button className="w-full" disabled={cart.items.length === 0}>Proceed to checkout</Button>
          </Link>
        </div>
      </aside>
    </div>
  );
}
