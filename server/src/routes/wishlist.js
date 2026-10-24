import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { notFound } from '../lib/errors.js';

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);

async function getOrCreate(userId) {
  let wl = await prisma.wishlist.findUnique({ where: { userId } });
  if (!wl) wl = await prisma.wishlist.create({ data: { userId } });
  return wl;
}

wishlistRouter.get('/', asyncHandler(async (req, res) => {
  const wl = await getOrCreate(req.user.id);
  const full = await prisma.wishlist.findUnique({
    where: { id: wl.id },
    include: { items: { include: { product: { include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } } } } },
  });
  res.json({ items: full.items });
}));

wishlistRouter.post('/', validate({ body: z.object({ productId: z.string().min(1) }) }), asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.body.productId } });
  if (!product || product.status !== 'PUBLISHED') throw notFound('Product not found');
  const wl = await getOrCreate(req.user.id);
  await prisma.wishlistItem.upsert({
    where: { wishlistId_productId: { wishlistId: wl.id, productId: product.id } },
    create: { wishlistId: wl.id, productId: product.id },
    update: {},
  });
  res.status(201).json({ ok: true });
}));

wishlistRouter.delete('/:productId', asyncHandler(async (req, res) => {
  const wl = await getOrCreate(req.user.id);
  await prisma.wishlistItem.deleteMany({ where: { wishlistId: wl.id, productId: req.params.productId } });
  res.json({ ok: true });
}));
