import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, conflict, unavailable } from '../lib/errors.js';
import { normalizeBdPhone } from '../lib/phone.js';
import { sumLines } from '../lib/money.js';
import { getShippingConfig, shippingFeeFor, getCodConfig } from '../lib/shipping.js';
import { validateCoupon, couponDiscount, eligibleSubtotal } from '../lib/coupons.js';
import { reserveStock } from '../lib/inventory.js';
import { initiatePayment, providerConfigured } from '../lib/payments.js';
import { sendMail, orderConfirmationMail } from '../lib/email.js';
import { auditLog } from '../lib/audit.js';

export const checkoutRouter = Router();

const checkoutSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(1),
  guestEmail: z.string().email().optional(),
  district: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  area: z.string().min(1).max(100),
  addressLine: z.string().min(3).max(300),
  notes: z.string().max(500).optional(),
  shippingMethod: z.string().default('standard'),
  paymentMethod: z.enum(['COD', 'SSLCOMMERZ', 'BKASH', 'NAGAD']),
  couponCode: z.string().optional(),
  addressId: z.string().optional(),
  idempotencyKey: z.string().min(8).max(100).optional(),
});

function orderNumber() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NV-${date}-${rand}`;
}

// Validate the cart and recompute everything server-side. Never trust
// client-submitted prices or totals.
checkoutRouter.post('/validate', validate({ body: z.object({ couponCode: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const cart = req.user
    ? await prisma.cart.findFirst({ where: { userId: req.user.id }, include: { items: { include: { product: true, variant: true } } } })
    : null;
  if (!cart || cart.items.length === 0) throw badRequest('Cart is empty');
  const lines = cart.items.map((i) => ({
    productId: i.productId, variantId: i.variantId, quantity: i.quantity,
    categoryId: i.product.categoryId,
    unitPrice: i.variant?.salePrice ?? i.variant?.price ?? i.product.salePrice ?? i.product.price,
  }));
  const subtotal = sumLines(lines);
  let discount = 0;
  let coupon = null;
  if (req.body.couponCode) {
    const result = await validateCoupon(req.body.couponCode, { lines, subtotal, userId: req.user?.id });
    coupon = result.coupon; discount = result.discount;
  }
  const shipping = await getShippingConfig();
  const shippingFee = shippingFeeFor(shipping, req.body.district || 'Dhaka', subtotal - discount);
  res.json({ subtotal, discount, shippingFee, grandTotal: subtotal - discount + shippingFee, coupon: coupon ? coupon.code : null });
}));

checkoutRouter.post('/orders', validate({ body: checkoutSchema }), asyncHandler(async (req, res) => {
  const d = req.body;
  const phone = normalizeBdPhone(d.customerPhone);
  if (!phone) throw badRequest('Invalid Bangladeshi phone number');

  // Idempotency: a retried/double-clicked submission with the same key
  // returns the original order instead of creating a duplicate.
  if (d.idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey: d.idempotencyKey }, include: { items: true } });
    if (existing) return res.status(200).json({ order: existing, duplicate: true });
  }

  const cart = req.user
    ? await prisma.cart.findFirst({ where: { userId: req.user.id }, include: { items: { include: { product: true, variant: true } } } })
    : null;
  // Guest checkout uses the guest cart cookie flow via the same cart table.
  const guestCart = !cart && req.cookies?.novara_guest
    ? await prisma.cart.findUnique({ where: { guestToken: req.cookies.novara_guest }, include: { items: { include: { product: true, variant: true } } } })
    : null;
  const activeCart = cart || guestCart;
  if (!activeCart || activeCart.items.length === 0) throw badRequest('Cart is empty');

  // Payment method gating: gateways must be configured to be offered.
  if (d.paymentMethod !== 'COD' && !providerConfigured(d.paymentMethod.toLowerCase())) {
    throw unavailable(`${d.paymentMethod} is not configured. Choose Cash on Delivery or contact the store.`);
  }
  if (d.paymentMethod === 'COD') {
    const cod = await getCodConfig();
    if (!cod.enabled) throw unavailable('Cash on Delivery is currently unavailable.');
    if (cod.districts && !cod.districts.includes(d.district)) throw badRequest('Cash on Delivery is not available in this district.');
  }

  const lines = activeCart.items.map((i) => ({
    productId: i.productId, variantId: i.variantId, quantity: i.quantity,
    productName: i.product.name, variantName: i.variant?.name || null,
    sku: i.variant?.sku || i.product.sku, categoryId: i.product.categoryId,
    unitPrice: i.variant?.salePrice ?? i.variant?.price ?? i.product.salePrice ?? i.product.price,
  }));
  const subtotal = sumLines(lines);

  if (d.paymentMethod === 'COD') {
    const cod = await getCodConfig();
    if (cod.minOrder && subtotal < cod.minOrder) throw badRequest('Order is below the COD minimum.');
    if (cod.maxOrder && subtotal > cod.maxOrder) throw badRequest('Order exceeds the COD maximum.');
  }

  let coupon = null;
  let discount = 0;
  if (d.couponCode) {
    const result = await validateCoupon(d.couponCode, { lines, subtotal, userId: req.user?.id });
    coupon = result.coupon; discount = result.discount;
  }
  const shipping = await getShippingConfig();
  const shippingFee = shippingFeeFor(shipping, d.district, subtotal - discount);
  const grandTotal = subtotal - discount + shippingFee;

  const order = await prisma.$transaction(async (tx) => {
    // Re-check coupon limits atomically under a row lock.
    if (coupon) {
      const locked = await tx.$queryRaw`SELECT id, "usageLimit" FROM "Coupon" WHERE id = ${coupon.id} FOR UPDATE`;
      void locked;
      const count = await tx.couponRedemption.count({ where: { couponId: coupon.id } });
      if (coupon.usageLimit !== null && count >= coupon.usageLimit) throw conflict('Coupon usage limit reached');
      if (req.user && coupon.perCustomerLimit !== null) {
        const mine = await tx.couponRedemption.count({ where: { couponId: coupon.id, userId: req.user.id } });
        if (mine >= coupon.perCustomerLimit) throw conflict('Coupon per-customer limit reached');
      }
    }
    const created = await tx.order.create({
      data: {
        orderNumber: orderNumber(),
        userId: req.user?.id || null,
        guestEmail: req.user ? null : (d.guestEmail || null),
        addressId: d.addressId || null,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentMethod: d.paymentMethod,
        subtotal, discountTotal: discount, shippingFee, grandTotal,
        couponId: coupon?.id || null,
        idempotencyKey: d.idempotencyKey || null,
        customerName: d.customerName, customerPhone: phone,
        district: d.district, city: d.city, area: d.area, addressLine: d.addressLine,
        notes: d.notes || null,
        items: { create: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, productName: l.productName, variantName: l.variantName, sku: l.sku, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.unitPrice * l.quantity })) },
        statusHistory: { create: { fromStatus: null, toStatus: 'PENDING', actorId: req.user?.id || null, reason: 'Order placed' } },
      },
      include: { items: true },
    });
    if (coupon) {
      await tx.couponRedemption.create({ data: { couponId: coupon.id, userId: req.user?.id || null, orderId: created.id } });
    }
    // Reserve stock atomically with the real order id; throws on shortage and
    // rolls the whole order back.
    try {
      await reserveStock(tx, lines, created.id);
    } catch (e) {
      if (String(e.message).startsWith('INSUFFICIENT_STOCK')) throw badRequest('One or more items are out of stock');
      throw e;
    }
    await tx.payment.create({ data: { orderId: created.id, method: d.paymentMethod, provider: d.paymentMethod.toLowerCase(), status: 'PENDING', amount: grandTotal } });
    // Clear the purchased cart.
    await tx.cartItem.deleteMany({ where: { cartId: activeCart.id } });
    return created;
  });

  // Payment initiation (COD: no redirect; gateways: configured flow or refusal).
  const paymentInit = await initiatePayment(d.paymentMethod.toLowerCase(), order).catch((e) => ({ error: e.message, status: e.status || 503 }));

  await auditLog({ actorId: req.user?.id || null, action: 'order.created', entity: 'Order', entityId: order.id, ipAddress: req.ip });
  if (order.guestEmail) {
    sendMail(orderConfirmationMail(order)).catch(() => {});
  } else if (req.user) {
    sendMail({ to: req.user.email, ...orderConfirmationMail(order) }).catch(() => {});
  }
  res.status(201).json({ order, paymentInit });
}));
