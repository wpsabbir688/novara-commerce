import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const publicRouter = Router();

// Public store settings (only safe keys) + homepage sections.
publicRouter.get('/store', asyncHandler(async (req, res) => {
  const rows = await prisma.storeSetting.findMany({ where: { key: { in: ['store', 'announcement', 'shipping', 'cod'] } } });
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ settings });
}));

publicRouter.get('/homepage', asyncHandler(async (req, res) => {
  const sections = await prisma.homepageSection.findMany({
    where: { isActive: true },
    include: { banners: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });
  const featured = await prisma.product.findMany({
    where: { status: 'PUBLISHED', isFeatured: true },
    include: { images: { take: 1, orderBy: { sortOrder: 'asc' } }, category: { select: { name: true, slug: true } } },
    take: 12,
  });
  const newArrivals = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
    include: { images: { take: 1, orderBy: { sortOrder: 'asc' } }, category: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  const deals = await prisma.product.findMany({
    where: { status: 'PUBLISHED', salePrice: { not: null } },
    include: { images: { take: 1, orderBy: { sortOrder: 'asc' } }, category: { select: { name: true, slug: true } } },
    take: 12,
  });
  const bestSellers = await prisma.orderItem.groupBy({ by: ['productId'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 12 });
  const bestSellerProducts = bestSellers.length
    ? await prisma.product.findMany({ where: { id: { in: bestSellers.map((b) => b.productId) }, status: 'PUBLISHED' }, include: { images: { take: 1, orderBy: { sortOrder: 'asc' } }, category: { select: { name: true, slug: true } } } })
    : [];
  res.json({ sections, featured, newArrivals, deals, bestSellers: bestSellerProducts });
}));
