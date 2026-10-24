import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { truncateAll, makeUser, makeProduct, loginAgent } from './helpers.js';

const app = createApp();
const orderBody = {
  customerName: 'Buyer', customerPhone: '01712345678',
  district: 'Dhaka', city: 'Dhaka', area: 'Mirpur', addressLine: 'House 1',
  paymentMethod: 'COD',
};

async function placeOrder(agent, product, key) {
  await agent.post('/api/v1/cart/items').send({ productId: product.id, quantity: 1 });
  const res = await agent.post('/api/v1/checkout/orders').send({ ...orderBody, idempotencyKey: key });
  if (res.status !== 201) throw new Error(`order failed: ${JSON.stringify(res.body)}`);
  return res.body.order;
}

describe('orders + payments', () => {
  let product;
  beforeEach(async () => {
    await truncateAll();
    await makeUser({ email: 'buyer@example.com' });
    await makeUser({ email: 'other@example.com' });
    await makeUser({ email: 'manager@example.com', role: 'ORDER_MANAGER' });
    product = await makeProduct({ name: 'Order Widget', price: 50000, stock: 10 });
  });

  it('customers cannot access another customer order (isolation)', async () => {
    const buyer = request.agent(app);
    await loginAgent(buyer, 'buyer@example.com');
    const order = await placeOrder(buyer, product, 'iso-key-1');
    const other = request.agent(app);
    await loginAgent(other, 'other@example.com');
    const res = await other.get(`/api/v1/orders/mine/${order.id}`);
    expect(res.status).toBe(404);
    const mine = await buyer.get(`/api/v1/orders/mine/${order.id}`);
    expect(mine.status).toBe(200);
  });

  it('invalid status transitions are rejected; valid ones move and deliver fulfills stock', async () => {
    const buyer = request.agent(app);
    await loginAgent(buyer, 'buyer@example.com');
    const order = await placeOrder(buyer, product, 'trans-key-1');
    const mgr = request.agent(app);
    await loginAgent(mgr, 'manager@example.com');
    const bad = await mgr.post(`/api/v1/orders/${order.id}/status`).send({ status: 'DELIVERED' });
    expect(bad.status).toBe(400);
    for (const s of ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']) {
      const r = await mgr.post(`/api/v1/orders/${order.id}/status`).send({ status: s });
      expect(r.status).toBe(200);
    }
    const inv = await prisma.inventory.findFirst({ where: { productId: product.id, variantId: null } });
    expect(inv.quantity).toBe(9); // fulfilled: deducted
    expect(inv.reserved).toBe(0);
  });

  it('cancelling releases the reservation', async () => {
    const buyer = request.agent(app);
    await loginAgent(buyer, 'buyer@example.com');
    const order = await placeOrder(buyer, product, 'cancel-key-1');
    const cancelled = await buyer.post(`/api/v1/orders/mine/${order.id}/cancel`).send({});
    expect(cancelled.status).toBe(200);
    const inv = await prisma.inventory.findFirst({ where: { productId: product.id, variantId: null } });
    expect(inv.reserved).toBe(0);
    expect(inv.quantity).toBe(10);
  });

  it('COD collection marks the order PAID; only staff can do it', async () => {
    const buyer = request.agent(app);
    await loginAgent(buyer, 'buyer@example.com');
    const order = await placeOrder(buyer, product, 'cod-key-1');
    const forbidden = await buyer.post(`/api/v1/payments/orders/${order.id}/cod-collect`).send({});
    expect(forbidden.status).toBe(403);
    const mgr = request.agent(app);
    await loginAgent(mgr, 'manager@example.com');
    const collected = await mgr.post(`/api/v1/payments/orders/${order.id}/cod-collect`).send({});
    expect(collected.status).toBe(200);
    expect(collected.body.order.paymentStatus).toBe('PAID');
    expect(collected.body.order.codCollectedAt).toBeTruthy();
  });

  it('a forged gateway callback cannot mark an order paid', async () => {
    const buyer = request.agent(app);
    await loginAgent(buyer, 'buyer@example.com');
    const order = await placeOrder(buyer, product, 'fake-cb-key-1');
    // Unconfigured provider: callback refused, order untouched.
    const cb = await request(app).post('/api/v1/webhooks/sslcommerz').send({ tran_id: 'FAKE', status: 'VALID', order_id: order.id });
    expect(cb.status).toBe(503);
    const after = await prisma.order.findUnique({ where: { id: order.id } });
    expect(after.paymentStatus).toBe('UNPAID');
  });

  it('admin dashboard reflects real records', async () => {
    const buyer = request.agent(app);
    await loginAgent(buyer, 'buyer@example.com');
    await placeOrder(buyer, product, 'dash-key-1');
    const admin = request.agent(app);
    await makeUser({ email: 'super@example.com', role: 'SUPER_ADMIN' });
    await loginAgent(admin, 'super@example.com');
    const dash = await admin.get('/api/v1/admin/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.body.orderCount).toBe(1);
    expect(dash.body.grossSales).toBe(56000); // 50000 + 6000 Dhaka shipping
    expect(dash.body.pendingOrders).toBe(1);
  });
});
