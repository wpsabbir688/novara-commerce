import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, forbidden, notFound, unavailable } from '../lib/errors.js';
import { providerConfigured, providerStatus, verifyCallback } from '../lib/payments.js';
import { auditLog } from '../lib/audit.js';

export const paymentsRouter = Router();

// Public (admin-configured) provider status — never exposes secrets.
paymentsRouter.get('/providers', asyncHandler(async (_req, res) => {
  res.json({ providers: providerStatus() });
}));

paymentsRouter.get('/orders/:orderId', requireAuth, asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId }, include: { payments: { include: { events: { orderBy: { createdAt: 'desc' } } } } } });
  if (!order) throw notFound('Order not found');
  if (order.userId && order.userId !== req.user.id) {
    const staff = (req.user.roles || []).some((r) => r.role.name !== 'CUSTOMER');
    if (!staff) throw forbidden('You cannot access this order');
  }
  res.json({ payments: order.payments });
}));

// COD collection confirmation — authorized staff only. This is the ONLY way a
// COD order becomes PAID (besides a verified gateway callback for gateways).
paymentsRouter.post('/orders/:orderId/cod-collect', requireAuth, requirePermission('orders:write'), asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId }, include: { payments: true } });
  if (!order) throw notFound('Order not found');
  if (order.paymentMethod !== 'COD') throw badRequest('Only COD orders can be collected this way');
  if (order.paymentStatus === 'PAID') throw badRequest('Order is already marked paid');
  const payment = order.payments[0];
  const updated = await prisma.$transaction(async (tx) => {
    if (payment) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } });
      await tx.paymentEvent.create({ data: { paymentId: payment.id, type: 'collected', payload: { by: req.user.id } } });
    }
    return tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', codCollectedAt: new Date() } });
  });
  await auditLog({ actorId: req.user.id, action: 'payment.cod_collected', entity: 'Order', entityId: order.id, ipAddress: req.ip });
  res.json({ order: updated });
}));

// COD reconciliation: unpaid COD orders with collection state.
paymentsRouter.get('/reconciliation/cod', requireAuth, requirePermission('orders:read'), asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { paymentMethod: 'COD' },
    select: { id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true, codCollectedAt: true, createdAt: true, customerName: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const summary = {
    total: orders.length,
    collected: orders.filter((o) => o.paymentStatus === 'PAID').length,
    pendingCollection: orders.filter((o) => o.paymentStatus !== 'PAID' && o.status === 'DELIVERED').length,
    amountCollected: orders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + o.grandTotal, 0),
    amountPending: orders.filter((o) => o.paymentStatus !== 'PAID').reduce((s, o) => s + o.grandTotal, 0),
  };
  res.json({ summary, orders });
}));

// ---- Webhooks: verified callbacks only. ----
// An unverified / unconfigured callback NEVER changes payment state.
export const webhooksRouter = Router();
webhooksRouter.post('/:provider', asyncHandler(async (req, res) => {
  const provider = req.params.provider.toLowerCase();
  if (!['sslcommerz', 'bkash', 'nagad'].includes(provider)) throw notFound('Unknown provider');
  if (!providerConfigured(provider)) {
    return res.status(503).json({ error: { code: 'PROVIDER_NOT_CONFIGURED', message: `${provider} is not configured; callback ignored.` } });
  }
  const verified = await verifyCallback(provider, req.body);
  if (!verified) {
    // Log the attempt for forensics, change nothing.
    console.warn(`Unverified ${provider} callback ignored`);
    return res.status(400).json({ error: { code: 'CALLBACK_NOT_VERIFIED', message: 'Callback could not be verified; no payment state changed.' } });
  }
  // Verified-callback handling (implemented when provider verification lands):
  // locate payment by transaction id, apply idempotent status update.
  res.json({ ok: true });
}));
