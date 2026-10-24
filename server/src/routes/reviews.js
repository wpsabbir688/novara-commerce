import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, notFound } from '../lib/errors.js';
import { auditLog } from '../lib/audit.js';

export const reviewsRouter = Router();

// Reviews are only shown publicly after staff approval. No fabricated reviews
// are ever seeded or displayed.
reviewsRouter.post('/', requireAuth, validate({ body: z.object({ productId: z.string().min(1), rating: z.number().int().min(1).max(5), title: z.string().max(200).optional(), body: z.string().max(2000).optional() }) }), asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.body.productId } });
  if (!product || product.status !== 'PUBLISHED') throw notFound('Product not found');
  // Only customers who purchased the product may review it.
  const purchased = await prisma.orderItem.count({
    where: { productId: product.id, order: { userId: req.user.id, status: { in: ['DELIVERED', 'SHIPPED', 'PROCESSING', 'CONFIRMED'] } } },
  });
  if (purchased === 0) throw badRequest('Only verified buyers can review this product');
  const review = await prisma.review.upsert({
    where: { productId_userId: { productId: product.id, userId: req.user.id } },
    create: { productId: product.id, userId: req.user.id, rating: req.body.rating, title: req.body.title, body: req.body.body, isApproved: false },
    update: { rating: req.body.rating, title: req.body.title, body: req.body.body, isApproved: false },
  });
  res.status(201).json({ review, note: 'Review submitted and pending moderation.' });
}));

reviewsRouter.get('/pending', requireAuth, requirePermission('reviews:moderate'), asyncHandler(async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { isApproved: false },
    include: { product: { select: { name: true, slug: true } }, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ reviews });
}));

reviewsRouter.post('/:id/moderate', requireAuth, requirePermission('reviews:moderate'), validate({ body: z.object({ action: z.enum(['approved', 'rejected']), reason: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) throw notFound('Review not found');
  const updated = await prisma.review.update({ where: { id: review.id }, data: { isApproved: req.body.action === 'approved' } });
  await prisma.reviewModeration.create({ data: { reviewId: review.id, moderatorId: req.user.id, action: req.body.action, reason: req.body.reason || null } });
  await auditLog({ actorId: req.user.id, action: `review.${req.body.action}`, entity: 'Review', entityId: review.id, ipAddress: req.ip });
  res.json({ review: updated });
}));
