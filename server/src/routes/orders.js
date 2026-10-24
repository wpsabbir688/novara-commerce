import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate, paginationQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { canTransition } from '../lib/orderTransitions.js';
import { releaseStock, fulfillStock } from '../lib/inventory.js';
import { auditLog } from '../lib/audit.js';

export const ordersRouter = Router();

const orderInclude = {
  items: { include: { product: { select: { slug: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } } } } },
  payments: { orderBy: { createdAt: 'desc' } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  shipments: true,
  internalNotes: { orderBy: { createdAt: 'desc' } },
};

// Customer: own orders only. Ownership is checked server-side on every read.
ordersRouter.get('/mine', requireAuth, validate({ query: paginationQuery }), asyncHandler(async (req, res) => {
  const { page, perPage } = req.query;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where: { userId: req.user.id }, include: { items: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    prisma.order.count({ where: { userId: req.user.id } }),
  ]);
  res.json({ orders, total, page, perPage });
}));

ordersRouter.get('/mine/:id', requireAuth, asyncHandler(async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: orderInclude });
  if (!order) throw notFound('Order not found');
  res.json({ order });
}));

ordersRouter.post('/mine/:id/cancel', requireAuth, validate({ body: z.object({ reason: z.string().max(300).optional() }) }), asyncHandler(async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { items: true } });
  if (!order) throw notFound('Order not found');
  if (!canTransition(order.status, 'CANCELLED')) throw badRequest(`Cannot cancel an order in status ${order.status}`);
  const updated = await prisma.$transaction(async (tx) => {
    await releaseStock(tx, order.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })), order.id, 'order_cancel_release');
    const o = await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledReason: req.body.reason || null } });
    await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: 'CANCELLED', actorId: req.user.id, reason: req.body.reason || 'Cancelled by customer' } });
    return o;
  });
  await auditLog({ actorId: req.user.id, action: 'order.cancelled', entity: 'Order', entityId: order.id, ipAddress: req.ip });
  res.json({ order: updated });
}));

// ---- Admin order processing ----
ordersRouter.get('/', requireAuth, requirePermission('orders:read'), validate({ query: paginationQuery.extend({ status: z.string().optional(), q: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const { page, perPage, status, q } = req.query;
  const where = {};
  if (status) where.status = status;
  if (q) where.OR = [{ orderNumber: { contains: q, mode: 'insensitive' } }, { customerName: { contains: q, mode: 'insensitive' } }, { customerPhone: { contains: q } }];
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    prisma.order.count({ where }),
  ]);
  res.json({ orders, total, page, perPage });
}));

ordersRouter.get('/:id', requireAuth, requirePermission('orders:read'), asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
  if (!order) throw notFound('Order not found');
  res.json({ order });
}));

ordersRouter.post('/:id/status', requireAuth, requirePermission('orders:write'), validate({ body: z.object({ status: z.enum(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED']), reason: z.string().max(300).optional(), trackingNumber: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!order) throw notFound('Order not found');
  if (!canTransition(order.status, req.body.status)) throw badRequest(`Invalid transition: ${order.status} -> ${req.body.status}`);
  const updated = await prisma.$transaction(async (tx) => {
    const items = order.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
    if (req.body.status === 'CANCELLED' || req.body.status === 'RETURNED') {
      await releaseStock(tx, items, order.id, `order_${req.body.status.toLowerCase()}_release`);
    }
    if (req.body.status === 'DELIVERED') {
      await fulfillStock(tx, items, order.id);
    }
    const data = { status: req.body.status };
    if (req.body.status === 'DELIVERED') data.fulfillmentStatus = 'FULFILLED';
    if (req.body.trackingNumber) data.trackingNumber = req.body.trackingNumber;
    if (req.body.status === 'CANCELLED') data.cancelledReason = req.body.reason || null;
    const o = await tx.order.update({ where: { id: order.id }, data });
    await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: req.body.status, actorId: req.user.id, reason: req.body.reason || null } });
    if (req.body.status === 'SHIPPED' && req.body.trackingNumber) {
      await tx.shipment.create({ data: { orderId: order.id, trackingNumber: req.body.trackingNumber, status: 'SHIPPED', shippedAt: new Date() } });
    }
    if (req.body.status === 'DELIVERED') {
      await tx.shipment.updateMany({ where: { orderId: order.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    }
    return o;
  });
  await auditLog({ actorId: req.user.id, action: 'order.status_changed', entity: 'Order', entityId: order.id, details: { from: order.status, to: req.body.status }, ipAddress: req.ip });
  res.json({ order: updated });
}));

ordersRouter.post('/:id/notes', requireAuth, requirePermission('orders:write'), validate({ body: z.object({ note: z.string().min(1).max(1000) }) }), asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) throw notFound('Order not found');
  const note = await prisma.orderNote.create({ data: { orderId: order.id, authorId: req.user.id, note: req.body.note, isInternal: true } });
  res.status(201).json({ note });
}));

export function assertCustomerOrderAccess(req, order) {
  if (!order || order.userId !== req.user.id) throw forbidden('You cannot access this order');
}
