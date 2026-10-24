import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate, paginationQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, notFound } from '../lib/errors.js';
import { adjustStock, lowStockProducts } from '../lib/inventory.js';
import { auditLog } from '../lib/audit.js';

export const adminRouter = Router();
adminRouter.use(requireAuth);

// ---- Dashboard: every metric comes from a real DB query. ----
adminRouter.get('/dashboard', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const paidOrCod = { status: { notIn: ['CANCELLED', 'REFUNDED'] } };
  const [orders, orderCount, grossAgg, customers, newCustomers, products, pendingOrders, recentOrders, bestSellers, lowStock] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: from, lte: to }, ...paidOrCod }, select: { grandTotal: true, discountTotal: true, status: true, createdAt: true } }),
    prisma.order.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.order.aggregate({ where: { createdAt: { gte: from, lte: to }, ...paidOrCod }, _sum: { grandTotal: true, discountTotal: true } }),
    prisma.user.count({ where: { roles: { some: { role: { name: 'CUSTOMER' } } } } }),
    prisma.user.count({ where: { createdAt: { gte: from, lte: to }, roles: { some: { role: { name: 'CUSTOMER' } } } } }),
    prisma.product.count({ where: { status: 'PUBLISHED' } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { items: true } }),
    prisma.orderItem.groupBy({ by: ['productId'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 }),
    lowStockProducts(),
  ]);
  const gross = grossAgg._sum.grandTotal || 0;
  const discounts = grossAgg._sum.discountTotal || 0;
  const bestSellerProducts = await prisma.product.findMany({
    where: { id: { in: bestSellers.map((b) => b.productId) } },
    select: { id: true, name: true, slug: true, price: true },
  });
  const byDay = {};
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + o.grandTotal;
  }
  res.json({
    grossSales: gross,
    netSales: gross - discounts,
    orderCount,
    avgOrderValue: orderCount ? Math.round(gross / orderCount) : 0,
    totalCustomers: customers,
    newCustomers,
    activeListings: products,
    pendingOrders,
    recentOrders,
    bestSellers: bestSellers.map((b) => ({ ...bestSellerProducts.find((p) => p.id === b.productId), quantity: b._sum.quantity })),
    lowStock: lowStock.map((r) => ({ product: r.product, variant: r.variant, available: r.quantity - r.reserved, threshold: r.lowThreshold })),
    salesByDay: Object.entries(byDay).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)),
  });
}));

// ---- Users / staff ----
adminRouter.get('/users', requirePermission('customers:read'), validate({ query: paginationQuery.extend({ q: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const { page, perPage, q } = req.query;
  const where = {};
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }];
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, include: { roles: { include: { role: true } }, _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    prisma.user.count({ where }),
  ]);
  res.json({ users: users.map((u) => ({ ...u, passwordHash: undefined })), total, page, perPage });
}));

adminRouter.get('/users/:id', requirePermission('customers:read'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { roles: { include: { role: true } }, addresses: true, orders: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 20 } } });
  if (!user) throw notFound('User not found');
  const { passwordHash, ...safe } = user;
  void passwordHash;
  res.json({ user: safe });
}));

adminRouter.post('/users/:id/roles', requirePermission('staff:write'), validate({ body: z.object({ role: z.enum(['SUPER_ADMIN', 'STORE_MANAGER', 'PRODUCT_MANAGER', 'ORDER_MANAGER', 'SUPPORT_AGENT', 'CUSTOMER']) }) }), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw notFound('User not found');
  const role = await prisma.role.findUnique({ where: { name: req.body.role } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, create: { userId: user.id, roleId: role.id }, update: {} });
  await auditLog({ actorId: req.user.id, action: 'staff.role_assigned', entity: 'User', entityId: user.id, details: { role: req.body.role }, ipAddress: req.ip });
  res.json({ ok: true });
}));

adminRouter.post('/users/:id/status', requirePermission('customers:write'), validate({ body: z.object({ isActive: z.boolean() }) }), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw notFound('User not found');
  if (user.id === req.user.id) throw badRequest('Cannot change your own status');
  const updated = await prisma.user.update({ where: { id: user.id }, data: { isActive: req.body.isActive } });
  await auditLog({ actorId: req.user.id, action: 'user.status_changed', entity: 'User', entityId: user.id, details: { isActive: req.body.isActive }, ipAddress: req.ip });
  res.json({ user: { id: updated.id, isActive: updated.isActive } });
}));

// ---- Inventory ----
adminRouter.get('/inventory', requirePermission('inventory:read'), validate({ query: paginationQuery.extend({ lowOnly: z.coerce.boolean().optional() }) }), asyncHandler(async (req, res) => {
  const { page, perPage, lowOnly } = req.query;
  const rows = await prisma.inventory.findMany({
    include: { product: { select: { id: true, name: true, sku: true, slug: true } }, variant: { select: { id: true, name: true, sku: true } }, movements: { orderBy: { createdAt: 'desc' }, take: 5 } },
    orderBy: { product: { name: 'asc' } },
    skip: (page - 1) * perPage, take: perPage,
  });
  const filtered = lowOnly ? rows.filter((r) => r.quantity - r.reserved <= r.lowThreshold) : rows;
  res.json({ inventory: filtered, total: await prisma.inventory.count() });
}));

adminRouter.post('/inventory/adjust', requirePermission('inventory:write'), validate({ body: z.object({ productId: z.string().min(1), variantId: z.string().optional().nullable(), delta: z.number().int(), reason: z.string().min(2).max(200) }) }), asyncHandler(async (req, res) => {
  const updated = await adjustStock({ ...req.body, actorId: req.user.id });
  await auditLog({ actorId: req.user.id, action: 'inventory.adjusted', entity: 'Inventory', entityId: updated.id, details: req.body, ipAddress: req.ip });
  res.json({ inventory: updated });
}));

// ---- Coupons ----
const couponInput = z.object({
  code: z.string().min(2).max(50),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().int().min(0),
  minOrderValue: z.number().int().min(0).default(0),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  perCustomerLimit: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
  productIds: z.array(z.string()).default([]),
  categoryIds: z.array(z.string()).default([]),
});

adminRouter.get('/coupons', requirePermission('coupons:read'), asyncHandler(async (req, res) => {
  const coupons = await prisma.coupon.findMany({ include: { _count: { select: { redemptions: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ coupons });
}));

adminRouter.post('/coupons', requirePermission('coupons:write'), validate({ body: couponInput }), asyncHandler(async (req, res) => {
  const d = req.body;
  if (d.discountType === 'PERCENTAGE' && d.discountValue > 100) throw badRequest('Percentage discount cannot exceed 100');
  const coupon = await prisma.coupon.create({
    data: {
      code: d.code.trim().toUpperCase(), discountType: d.discountType, discountValue: d.discountValue,
      minOrderValue: d.minOrderValue, startsAt: d.startsAt ? new Date(d.startsAt) : null, expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      usageLimit: d.usageLimit, perCustomerLimit: d.perCustomerLimit, isActive: d.isActive,
      products: { create: d.productIds.map((productId) => ({ productId })) },
      categories: { create: d.categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });
  await auditLog({ actorId: req.user.id, action: 'coupon.created', entity: 'Coupon', entityId: coupon.id, ipAddress: req.ip });
  res.status(201).json({ coupon });
}));

adminRouter.put('/coupons/:id', requirePermission('coupons:write'), validate({ body: couponInput.partial() }), asyncHandler(async (req, res) => {
  const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Coupon not found');
  const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: req.body });
  await auditLog({ actorId: req.user.id, action: 'coupon.updated', entity: 'Coupon', entityId: coupon.id, ipAddress: req.ip });
  res.json({ coupon });
}));

// ---- Settings ----
adminRouter.get('/settings', requirePermission('settings:read'), asyncHandler(async (req, res) => {
  const settings = await prisma.storeSetting.findMany();
  res.json({ settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
}));

adminRouter.put('/settings', requirePermission('settings:write'), validate({ body: z.object({ settings: z.record(z.any()) }) }), asyncHandler(async (req, res) => {
  for (const [key, value] of Object.entries(req.body.settings)) {
    await prisma.storeSetting.upsert({ where: { key }, create: { key, value, updatedBy: req.user.id }, update: { value, updatedBy: req.user.id } });
  }
  await auditLog({ actorId: req.user.id, action: 'settings.updated', entity: 'StoreSetting', details: { keys: Object.keys(req.body.settings) }, ipAddress: req.ip });
  res.json({ ok: true });
}));

// ---- Content: homepage sections + banners ----
adminRouter.get('/content/sections', requirePermission('content:read'), asyncHandler(async (req, res) => {
  const sections = await prisma.homepageSection.findMany({ include: { banners: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } });
  res.json({ sections });
}));

adminRouter.put('/content/sections/:id', requirePermission('content:write'), validate({ body: z.object({ title: z.string().optional(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional(), config: z.any().optional() }) }), asyncHandler(async (req, res) => {
  const section = await prisma.homepageSection.findUnique({ where: { id: req.params.id } });
  if (!section) throw notFound('Section not found');
  const updated = await prisma.homepageSection.update({ where: { id: req.params.id }, data: req.body });
  res.json({ section: updated });
}));

adminRouter.post('/content/banners', requirePermission('content:write'), validate({ body: z.object({ sectionId: z.string().optional().nullable(), title: z.string().min(1), subtitle: z.string().optional(), imageUrl: z.string().url(), ctaLabel: z.string().optional(), ctaHref: z.string().optional(), sortOrder: z.number().int().default(0), isActive: z.boolean().default(true) }) }), asyncHandler(async (req, res) => {
  const banner = await prisma.banner.create({ data: req.body });
  res.status(201).json({ banner });
}));

// ---- Reports (CSV export, permission-gated, no unnecessary PII) ----
adminRouter.get('/reports/:type.csv', requirePermission('reports:export'), asyncHandler(async (req, res) => {
  const type = req.params.type;
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  let csv = '';
  if (type === 'orders') {
    const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 });
    csv = 'orderNumber,status,paymentStatus,paymentMethod,grandTotal,createdAt\n' + orders.map((o) => [o.orderNumber, o.status, o.paymentStatus, o.paymentMethod, o.grandTotal, o.createdAt.toISOString()].map(esc).join(',')).join('\n');
  } else if (type === 'products') {
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' }, take: 5000 });
    csv = 'name,sku,status,price,salePrice\n' + products.map((p) => [p.name, p.sku, p.status, p.price, p.salePrice].map(esc).join(',')).join('\n');
  } else if (type === 'inventory') {
    const rows = await prisma.inventory.findMany({ include: { product: true, variant: true }, take: 5000 });
    csv = 'product,sku,variant,quantity,reserved,available\n' + rows.map((r) => [r.product.name, r.variant?.sku || r.product.sku, r.variant?.name || '', r.quantity, r.reserved, r.quantity - r.reserved].map(esc).join(',')).join('\n');
  } else {
    throw notFound('Unknown report type');
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="novara-${type}.csv"`);
  res.send(csv);
}));

// ---- Audit log ----
adminRouter.get('/audit-log', requirePermission('staff:read'), validate({ query: paginationQuery }), asyncHandler(async (req, res) => {
  const { page, perPage } = req.query;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    prisma.auditLog.count(),
  ]);
  res.json({ logs, total, page, perPage });
}));
