import { prisma } from '../db/prisma.js';

// Shipping rules are configurable via StoreSetting key "shipping".
// Shape: { defaultFee, freeAbove, districts: { "Dhaka": { fee, freeAbove } } }
// All amounts in minor units (poisha). Defaults apply when no setting exists.
export const DEFAULT_SHIPPING = {
  defaultFee: 8000, // ৳80
  freeAbove: 500000, // free shipping above ৳5,000
  districts: {
    Dhaka: { fee: 6000, freeAbove: 500000 },
  },
};

export async function getShippingConfig() {
  const row = await prisma.storeSetting.findUnique({ where: { key: 'shipping' } });
  if (!row || typeof row.value !== 'object') return DEFAULT_SHIPPING;
  return { ...DEFAULT_SHIPPING, ...row.value, districts: { ...DEFAULT_SHIPPING.districts, ...(row.value.districts || {}) } };
}

export function shippingFeeFor(config, district, subtotalAfterDiscount) {
  const rule = config.districts?.[district] || { fee: config.defaultFee, freeAbove: config.freeAbove };
  if (rule.freeAbove && subtotalAfterDiscount >= rule.freeAbove) return 0;
  return rule.fee;
}

export async function getCodConfig() {
  const row = await prisma.storeSetting.findUnique({ where: { key: 'cod' } });
  const defaults = { enabled: true, minOrder: 0, maxOrder: null, districts: null };
  if (!row || typeof row.value !== 'object') return defaults;
  return { ...defaults, ...row.value };
}
