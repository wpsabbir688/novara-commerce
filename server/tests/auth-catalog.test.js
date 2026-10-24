import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { truncateAll, makeUser, makeProduct, loginAgent } from './helpers.js';

const app = createApp();

describe('auth', () => {
  beforeEach(async () => { await truncateAll(); });

  it('registers with BD phone normalization and logs in', async () => {
    const agent = request.agent(app);
    const reg = await agent.post('/api/v1/auth/register').send({ name: 'Asha', email: 'asha@example.com', password: 'Secret123', phone: '01712345678' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.phone).toBe('+8801712345678');
    expect(reg.body.user.roles).toContain('CUSTOMER');
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('asha@example.com');
  });

  it('rejects invalid BD phone and duplicate email', async () => {
    const bad = await request(app).post('/api/v1/auth/register').send({ name: 'Bad', email: 'bad@example.com', password: 'Secret123', phone: '01234' });
    expect(bad.status).toBe(400);
    await makeUser({ email: 'dup@example.com' });
    const dup = await request(app).post('/api/v1/auth/register').send({ name: 'Dup', email: 'dup@example.com', password: 'Secret123' });
    expect(dup.status).toBe(409);
  });

  it('rejects wrong password and requires auth for /me', async () => {
    await makeUser({ email: 'u@example.com' });
    const bad = await request(app).post('/api/v1/auth/login').send({ email: 'u@example.com', password: 'WrongPass' });
    expect(bad.status).toBe(401);
    const me = await request(app).get('/api/v1/auth/me');
    expect(me.status).toBe(401);
  });

  it('customer cannot access admin routes (403)', async () => {
    const user = await makeUser({ email: 'cust@example.com' });
    const agent = request.agent(app);
    await loginAgent(agent, 'cust@example.com');
    const res = await agent.get('/api/v1/admin/dashboard');
    expect(res.status).toBe(403);
    expect(user.email).toBe('cust@example.com');
  });
});

describe('catalog', () => {
  beforeEach(async () => {
    await truncateAll();
    await makeProduct({ name: 'Alpha Widget', price: 100000, stock: 5 });
    await makeProduct({ name: 'Beta Gadget', price: 200000, stock: 0, status: 'DRAFT' });
  });

  it('lists only published products and filters by price', async () => {
    const all = await request(app).get('/api/v1/products');
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(1);
    expect(all.body.products[0].name).toBe('Alpha Widget');
    const filtered = await request(app).get('/api/v1/products?minPrice=150000');
    expect(filtered.body.total).toBe(0);
  });

  it('search suggestions return real catalog matches', async () => {
    const res = await request(app).get('/api/v1/products/suggest?q=Alpha');
    expect(res.body.products.length).toBe(1);
    expect(res.body.products[0].name).toBe('Alpha Widget');
  });

  it('draft products are hidden from the public detail page', async () => {
    const draft = await prisma.product.findFirst({ where: { status: 'DRAFT' } });
    const res = await request(app).get(`/api/v1/products/${draft.slug}`);
    expect(res.status).toBe(404);
  });
});
