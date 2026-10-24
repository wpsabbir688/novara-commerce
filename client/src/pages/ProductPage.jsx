import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Heart, Star, Minus, Plus } from 'lucide-react';
import { get, post } from '../services/apiClient.js';
import { ProductPrice } from '../components/products/ProductPrice.jsx';
import { ProductGrid } from '../components/products/ProductCard.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';

export function ProductPage() {
  const { slug } = useParams();
  const { add } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [imageIdx, setImageIdx] = useState(0);
  const [zoom, setZoom] = useState(false);

  const { data, isLoading, error } = useQuery({ queryKey: ['product', slug], queryFn: () => get(`/products/${slug}`) });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !data) return <div className="py-10 text-center"><p>Product not found.</p><Link to="/shop" className="text-brand">Back to shop</Link></div>;

  const { product, related, avgRating, reviewCount } = data;
  const variant = product.variants?.find((v) => v.id === variantId) || null;
  const images = product.images || [];
  const available = (() => {
    if (variant) return variant.inventory?.reduce((s, i) => s + (i.quantity - i.reserved), 0) || 0;
    return product.inventory?.reduce((s, i) => s + (i.quantity - i.reserved), 0) || 0;
  })();

  const addToCart = async (buyNow = false) => {
    if (product.variants?.length && !variant) return toast.push('Please select a variant', 'error');
    if (qty > available) return toast.push(`Only ${available} unit(s) available`, 'error');
    try {
      await add(product.id, variant?.id || null, qty);
      toast.push('Added to cart', 'success');
      if (buyNow) window.location.href = '/checkout';
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };

  return (
    <div>
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand">Home</Link> / <Link to="/shop" className="hover:text-brand">Shop</Link> / <Link to={`/category/${product.category?.slug}`} className="hover:text-brand">{product.category?.name}</Link> / <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-3xl border border-line bg-soft">
            {images[imageIdx] ? (
              <img src={images[imageIdx].url} alt={images[imageIdx].altText || product.name} onClick={() => setZoom(!zoom)} className={`w-full cursor-zoom-in object-cover ${zoom ? 'scale-150 cursor-zoom-out' : 'aspect-square'}`} />
            ) : (
              <div className="flex aspect-square items-center justify-center text-muted">No image</div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            {images.map((img, i) => (
              <button key={img.id} onClick={() => setImageIdx(i)} aria-label={`View image ${i + 1}`} className={`overflow-hidden rounded-xl border-2 ${i === imageIdx ? 'border-brand' : 'border-line'}`}>
                <img src={img.url} alt="" className="h-16 w-16 object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-muted">{product.category?.name}{product.brand ? ` · ${product.brand.name}` : ''}</p>
          <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
          <p className="mt-1 text-sm text-muted">SKU: {variant?.sku || product.sku}</p>
          {avgRating && (
            <p className="mt-2 flex items-center gap-1 text-sm">
              <Star size={16} className="fill-warning text-warning" /> {avgRating.toFixed(1)} ({reviewCount} approved review{reviewCount === 1 ? '' : 's'})
            </p>
          )}
          <div className="mt-4"><ProductPrice product={product} variant={variant} /></div>
          <p className="mt-1 text-sm">
            {available > 0 ? <span className="text-success font-medium">In stock ({available} available)</span> : <span className="text-error font-medium">Out of stock</span>}
          </p>

          {product.variants?.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">Select variant</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button key={v.id} onClick={() => setVariantId(v.id)} disabled={!v.isActive} className={`rounded-xl border px-4 py-2 text-sm ${variantId === v.id ? 'border-brand bg-brand/10 text-brand' : 'border-line'} disabled:opacity-40`}>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-line">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2" aria-label="Decrease quantity"><Minus size={16} /></button>
              <span className="w-10 text-center">{qty}</span>
              <button onClick={() => setQty(Math.min(available || 1, qty + 1))} className="px-3 py-2" aria-label="Increase quantity"><Plus size={16} /></button>
            </div>
            <Button onClick={() => addToCart(false)} disabled={available <= 0}><ShoppingCart size={16} /> Add to cart</Button>
            <Button variant="dark" onClick={() => addToCart(true)} disabled={available <= 0}>Buy now</Button>
            <button
              onClick={async () => {
                if (!user) return toast.push('Log in to use the wishlist', 'error');
                await post('/wishlist', { productId: product.id }).then(() => toast.push('Saved to wishlist', 'success')).catch((e) => toast.push(e.message, 'error'));
              }}
              aria-label="Add to wishlist"
              className="rounded-xl border border-line p-2.5 hover:text-error"
            >
              <Heart size={18} />
            </button>
          </div>

          {product.shortDescription && <p className="mt-5 text-muted">{product.shortDescription}</p>}
          {product.description && <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{product.description}</div>}
          <div className="mt-6 rounded-2xl border border-line bg-soft p-4 text-sm">
            <p><strong>Delivery:</strong> Nationwide delivery with Cash on Delivery. Fees are calculated at checkout.</p>
            <p className="mt-1"><strong>Returns:</strong> Return and refund requests can be raised from your order history.</p>
          </div>

          {product.reviews?.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold">Customer reviews</h2>
              {product.reviews.map((r) => (
                <div key={r.id} className="mt-3 rounded-2xl border border-line p-4">
                  <p className="flex items-center gap-1 text-sm font-medium"><Star size={14} className="fill-warning text-warning" /> {r.rating}/5 — {r.user?.name}</p>
                  {r.title && <p className="mt-1 font-medium">{r.title}</p>}
                  {r.body && <p className="mt-1 text-sm text-muted">{r.body}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {related?.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold">Related products</h2>
          <div className="mt-4"><ProductGrid products={related} /></div>
        </section>
      )}
    </div>
  );
}
