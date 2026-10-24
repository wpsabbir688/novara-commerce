import { describe, it, expect } from 'vitest';
import { toMinor, fromMinor, percentOf, sumLines } from '../src/lib/money.js';
import { normalizeBdPhone, isValidBdPhone } from '../src/lib/phone.js';
import { canTransition, isTerminalStatus } from '../src/lib/orderTransitions.js';
import { eligibleSubtotal, couponDiscount, couponIsActiveNow } from '../src/lib/coupons.js';
import { userHasPermission } from '../src/lib/permissions.js';

describe('money', () => {
  it('converts major to minor units without float error', () => {
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(0.1)).toBe(10);
    expect(fromMinor(1999)).toBe(19.99);
  });
  it('computes percent discounts rounded to poisha', () => {
    expect(percentOf(10000, 10)).toBe(1000);
    expect(percentOf(999, 33)).toBe(330);
  });
  it('sums line totals', () => {
    expect(sumLines([{ unitPrice: 1000, quantity: 2 }, { unitPrice: 500, quantity: 3 }])).toBe(3500);
  });
});

describe('BD phone', () => {
  it('normalizes local, +880 and 880 formats', () => {
    expect(normalizeBdPhone('01712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('+8801712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('8801712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('01712 345 678')).toBe('+8801712345678');
  });
  it('rejects invalid numbers', () => {
    expect(isValidBdPhone('01212345678')).toBe(false);
    expect(isValidBdPhone('0171234567')).toBe(false);
    expect(isValidBdPhone('not-a-phone')).toBe(false);
  });
});

describe('order transitions', () => {
  it('allows the documented forward path', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'PROCESSING')).toBe(true);
    expect(canTransition('PROCESSING', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });
  it('rejects skips and backwards moves', () => {
    expect(canTransition('PENDING', 'SHIPPED')).toBe(false);
    expect(canTransition('DELIVERED', 'PENDING')).toBe(false);
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
  });
  it('marks terminal states', () => {
    expect(isTerminalStatus('CANCELLED')).toBe(true);
    expect(isTerminalStatus('REFUNDED')).toBe(true);
    expect(isTerminalStatus('SHIPPED')).toBe(false);
  });
});

describe('coupons', () => {
  const coupon = {
    isActive: true, startsAt: null, expiresAt: null, discountType: 'PERCENTAGE', discountValue: 10,
    products: [], categories: [],
  };
  it('computes eligible subtotal across all items when unrestricted', () => {
    const lines = [{ productId: 'a', categoryId: 'c1', unitPrice: 1000, quantity: 2 }];
    expect(eligibleSubtotal(coupon, lines)).toBe(2000);
    expect(couponDiscount(coupon, 2000)).toBe(200);
  });
  it('restricts to listed products', () => {
    const restricted = { ...coupon, products: [{ productId: 'a' }] };
    const lines = [
      { productId: 'a', categoryId: 'c1', unitPrice: 1000, quantity: 1 },
      { productId: 'b', categoryId: 'c1', unitPrice: 5000, quantity: 1 },
    ];
    expect(eligibleSubtotal(restricted, lines)).toBe(1000);
  });
  it('caps fixed discounts at the eligible amount', () => {
    const fixed = { ...coupon, discountType: 'FIXED', discountValue: 5000 };
    expect(couponDiscount(fixed, 3000)).toBe(3000);
  });
  it('respects active windows', () => {
    expect(couponIsActiveNow({ ...coupon, isActive: false })).toBe(false);
    expect(couponIsActiveNow({ ...coupon, expiresAt: new Date(Date.now() - 1000) })).toBe(false);
    expect(couponIsActiveNow({ ...coupon, startsAt: new Date(Date.now() + 10000) })).toBe(false);
    expect(couponIsActiveNow(coupon)).toBe(true);
  });
});

describe('permissions', () => {
  const staff = (roles) => ({ roles: roles.map((name) => ({ role: { name } })) });
  it('super admin has everything', () => {
    expect(userHasPermission(staff(['SUPER_ADMIN']), 'products:delete')).toBe(true);
    expect(userHasPermission(staff(['SUPER_ADMIN']), 'staff:write')).toBe(true);
  });
  it('product manager cannot manage orders or staff', () => {
    expect(userHasPermission(staff(['PRODUCT_MANAGER']), 'products:write')).toBe(true);
    expect(userHasPermission(staff(['PRODUCT_MANAGER']), 'orders:write')).toBe(false);
    expect(userHasPermission(staff(['PRODUCT_MANAGER']), 'staff:write')).toBe(false);
  });
  it('customers have no staff permissions', () => {
    expect(userHasPermission(staff(['CUSTOMER']), 'products:read')).toBe(false);
    expect(userHasPermission(null, 'products:read')).toBe(false);
  });
});
