import { createContext, useContext, useEffect, useState } from 'react';
import { get, post, put, del } from '../services/apiClient.js';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ items: [], subtotal: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refresh = async () => {
    const d = await get('/cart').catch(() => ({ items: [], subtotal: 0 }));
    setCart(d);
    return d;
  };

  useEffect(() => {
    refresh();
  }, []);

  const add = async (productId, variantId, quantity = 1) => {
    await post('/cart/items', { productId, variantId: variantId || null, quantity });
    await refresh();
    setDrawerOpen(true);
  };

  const updateQty = async (itemId, quantity) => {
    await put(`/cart/items/${itemId}`, { quantity });
    await refresh();
  };

  const remove = async (itemId) => {
    await del(`/cart/items/${itemId}`);
    await refresh();
  };

  const count = cart.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, count, drawerOpen, setDrawerOpen, refresh, add, updateQty, remove }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
