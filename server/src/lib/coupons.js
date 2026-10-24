import { prisma } from '../db/prisma.js';
import { percentOf } from './money.js';
import { badRequest } from './errors.js';

// Coupon eligibility is validated server-side on every use. Usage limits are
// enforced inside the order transaction with a row lock on the coupon, so
// concurrent checkouts cannot exceed the limit.

export function couponIsActiveNow(coupon, now = new Date()) {
  if (!coupon.isActive) return false;
  if (coupon.startsAt && now < coupon.startsAt) return false;
  if (coupon.expiresAt && now > coupon.expiresAt) return false;
  return true;
}

/** Eligible subtotal: only items matching product/category restrictions (or all). */
export function eligibleSubtotal(coupon, lines) {
  const productIds = new Set((coupon.products || []).map((p) => p.productId));
  const categoryIds = new Set((coupon.categories || []).map((c) => c.categoryId));
  const restricted = productIds.size > 0 || categoryIds.size > 0;
  return lines.reduce((sum, l) => {
    if (!restricted) return sum + l.unitPrice * l.quantity;
    if (productIds.has(l.productId)) return sum + l.unitPrice * l.quantity;
    if (l.categoryId && categoryIds.has(l.categoryId)) return sum + l.unitPrice * l.quantity;
    return sum;
  }, 0);
}

export function couponDiscount(coupon, eligibleAmount) {
  if (coupon.discountType === 'PERCENTAGE') return percentOf(eligibleAmount, coupon.discountValue);
  return Math.min(coupon.discountValue, eligibleAmount);
}

/**
 * Validate a coupon code for a cart. Returns { coupon, discount } or throws.
 * Limit checks that need atomicity run again inside the order transaction.
 */
export async function validateCoupon(code, { lines, subtotal, userId }) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { products: true, categories: true, redemptions: true },
  });
  if (!coupon) throw badRequest('coupon not_found', 'COUPON_NOT_FOUND');
  if (!couponIsActiveNow(coupon)) throw badRequest('coupon inactive', 'COUPON_INACTIVE');
  if (subtotal < coupon.minOrderValue) throw badRequest('coupon min_order', 'COUPON_MIN_ORDER');
  if (coupon.usageLimit !== null && coupon.redemptions.length >= coupon.usageLimit) {
    throw badRequest('coupon limit_reached', 'COUPON_LIMIT_REACHED');
  }
  if (userId && coupon.perCustomerLimit !== null) {
    const mine = coupon.redemptions.filter((r) => r.userId === userId).length;
    if (mine >= coupon.perCustomerLimit) throw badRequest('coupon customer_limit', 'COUPON_CUSTOMER_LIMIT');
  }
  const eligible = eligibleSubtotal(coupon, lines);
  if (eligible <= 0) throw badRequest('coupon no_eligible_items', 'COUPON_NO_ELIGIBLE_ITEMS');
  return { coupon, discount: couponDiscount(coupon, eligible) };
}
