import { formatBDT, discountPercent } from '../../utils/currency.js';

export function ProductPrice({ product, variant }) {
  const base = variant?.price ?? product.price;
  const sale = variant?.salePrice ?? product.salePrice;
  const shown = sale ?? base;
  const pct = discountPercent(base, sale);
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-navy">{formatBDT(shown)}</span>
      {sale && <span className="text-muted line-through">{formatBDT(base)}</span>}
      {pct > 0 && <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-bold text-error">Save {pct}%</span>}
    </div>
  );
}
