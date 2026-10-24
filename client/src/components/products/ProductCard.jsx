import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart } from 'lucide-react';
import { formatBDT, discountPercent } from '../../utils/currency.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../ui/Toast.jsx';
import { post } from '../../services/apiClient.js';

export function ProductCard({ product }) {
  const { add } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const image = product.images?.[0]?.url;
  const price = product.salePrice ?? product.price;
  const pct = discountPercent(product.price, product.salePrice);

  const quickAdd = async (e) => {
    e.preventDefault();
    try {
      await add(product.id, null, 1);
      toast.push('Added to cart', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };

  const wishlist = async (e) => {
    e.preventDefault();
    if (!user) return toast.push('Log in to use the wishlist', 'error');
    try {
      await post('/wishlist', { productId: product.id });
      toast.push('Saved to wishlist', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Link to={`/product/${product.slug}`} className="group block overflow-hidden rounded-2xl border border-line bg-white shadow-sm hover:shadow-md">
        <div className="relative aspect-square overflow-hidden bg-soft">
          {image ? <img src={image} alt={product.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-muted">No image</div>}
          {pct > 0 && <span className="absolute left-2 top-2 rounded-full bg-error px-2 py-0.5 text-xs font-bold text-white">-{pct}%</span>}
          <button onClick={wishlist} aria-label="Add to wishlist" className="absolute right-2 top-2 rounded-full bg-white p-2 shadow hover:text-error">
            <Heart size={16} />
          </button>
        </div>
        <div className="p-3">
          <p className="text-xs text-muted">{product.category?.name}</p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-medium">{product.name}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-bold text-navy">{formatBDT(price)}</span>
            {product.salePrice && <span className="text-xs text-muted line-through">{formatBDT(product.price)}</span>}
          </div>
          <button onClick={quickAdd} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-navy py-2 text-sm font-medium text-white hover:bg-ink">
            <ShoppingCart size={16} /> Add to cart
          </button>
        </div>
      </Link>
    </motion.div>
  );
}

export function ProductGrid({ products }) {
  if (!products?.length) {
    return <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">No products found. Try clearing filters.</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
