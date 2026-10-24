import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { truncateAll, makeUser, makeProduct, loginAgent } from './helpers.js';

const app = createApp();
const orderBody = {
  customerName: 'Test Buyer', customerPhone: '01712345678',
  district: 'Dhaka', city: 'Dhaka', area: 'Mirpur', addressLine: 'House 1, Road 2',
  paymentMethod: 'COD',
};

describe('cart + COD checkout', () => {
  let product;
  beforeEach(async () => {
    await truncateAll();
    await makeUser({ email: 'buyer@example.com' });
    product = await makeProduct({ name: 'Checkout Widget', price: 100000, stock: 5 });
  });

  it('adds to cart, rejects overstock, and places a COD order with server totals', async () => {
    const agent = request.agent(app);
    await loginAgent(agent, 'buyer@example.com');
    const over = await agent.post('/api/v1/cart/items').send({ productId: product.id, quantity: 6 });
    expect(over.status).toBe(400);
    const added = await agent.post('/api/v1/cart/items').send({ productId: product.id, quantity: 2 });
    expect(added.status).toBe(201);
    expect(added.body.subtotal).toBe(200000);

    const order = await agent.post('/api/v1/checkout/orders').send({ ...orderBody, idempotencyKey: 'key-00001' });
    expect(order.status).toBe(201);
    expect(order.body.order.status).toBe('PENDING');
    expect(order.body.order.paymentStatus).toBe('UNPAID');
    expect(order.body.order.paymentMethod).toBe('COD');
    // Server-side totals: 2 x 100000 + Dhaka shipping 6000 = 206000
    expect(order.body.order.subtotal).toBe(200000);
    expect(order.body.order.shippingFee).toBe(6000);
    expect(order.body.order.grandTotal).toBe(206000);
    expect(order.body.order.items[0].unitPrice).toBe(100000);

    const inv = await prisma.inventory.findFirst({ where: { productId: product.id, variantId: null } });
    expect(inv.reserved).toBe(2);
    expect(inv.quantity).toBe(5);
  });

  it('idempotency key prevents duplicate orders on retry', async () => {
    const agent = request.agent(app);
    await loginAgent(agent, 'buyer@example.com');
    await agent.post('/api/v1/cart/items').send({ productId: product.id, quantity: 1 });
    const first = await agent.post('/api/v1/checkout/orders').send({ ...orderBody, idempotencyKey: 'key-duplicate' });
    expect(first.status).toBe(201);
    const retry = await agent.post('/api/v1/checkout/orders').send({ ...orderBody, idempotencyKey: 'key-duplicate' });
    expect(retry.status).toBe(200);
    expect(retry.body.duplicate).toBe(true);
    expect(retry.body.order.id).toBe(first.body.order.id);
    const count = await prisma.order.count();
    expect(count).toBe(1);
  });

  it('coupon discount applies server-side and respects usage limits', async () => {
    const agent = request.agent(app);
    await loginAgent(agent, 'buyer@example.com');
    await prisma.coupon.create({ data: { code: 'SAVE10', discountType: 'PERCENTAGE', discountValue: 10, usageLimit: 1 } });
    await agent.post('/api/v1/cart/items').send({ productId: product.id, quantity: 1 });
    const order = await agent.post('/api/v1/checkout/orders').send({ ...orderBody, couponCode: 'SAVE10', idempotencyKey: 'key-coupon' });
    expect(order.status).toBe(201);
    expect(order.body.order.discountTotal).toBe(10000);
    // Second use must fail: limit reached (cart re-added for the second attempt)
    await agent.post('/api/v1/cart/items').send({ productId: product.id, quantity: 1 });
    const second = await agent.post('/api/v1/checkout/orders').send({ ...orderBody, couponCode: 'SAVE10', idempotencyKey: 'key-coupon-2' });
    expect(second.status).toBe(400);
  });

  it('unconfigured gateways are refused at checkout', async () => {
    const agent = request.agent(app);
    await loginAgent(agent, 'buyer@example.com');
    await agent.post('/api/v1/cart/items').send({ productId: product.id, quantity: 1 });
    const res = await agent.post('/api/v1/checkout/orders').send({ ...orderBody, paymentMethod: 'BKASH', idempotencyKey: 'key-bkash' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
