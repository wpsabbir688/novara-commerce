import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate, paginationQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, notFound } from '../lib/errors.js';
import { auditLog } from '../lib/audit.js';

export const productsRouter = Router();

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const productInput = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).optional(),
  shortDescription: z.string().max(500).optional().nullable(),
  description: z.string().optional().nullable(),
  sku: z.string().min(1).max(100),
  barcode: z.string().optional().nullable(),
  categoryId: z.string().min(1),
  brandId: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  isFeatured: z.boolean().default(false),
  price: z.number().int().min(0),
  salePrice: z.number().int().min(0).optional().nullable(),
  weightGrams: z.number().int().min(0).optional().nullable(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(300).optional().nullable(),
  publishAt: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).default([]),
  images: z.array(z.object({ url: z.string().url(), altText: z.string().optional() })).default([]),
  variants: z.array(z.object({
    name: z.string().min(1),
    sku: z.string().min(1),
    price: z.number().int().min(0).optional().nullable(),
    salePrice: z.number().int().min(0).optional().nullable(),
    stock: z.number().int().min(0).default(0),
  })).default([]),
  stock: z.number().int().min(0).default(0),
});

const listQuery = paginationQuery.extend({
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'popularity']).default('relevance'),
  featured: z.coerce.boolean().optional(),
  staff: z.coerce.boolean().optional(),
});

function publicWhere(query, staffView) {
  const where = {};
  if (!staffView) {
    where.status = 'PUBLISHED';
    where.OR = [{ publishAt: null }, { publishAt: { lte: new Date() } }];
  }
  if (query.q) {
    where.AND = [
      ...(where.AND || []),
      { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }, { sku: { contains: query.q, mode: 'insensitive' } }] },
    ];
  }
  if (query.category) where.category = { slug: query.category };
  if (query.brand) where.brand = { slug: query.brand };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {};
    if (query.minPrice !== undefined) where.price.gte = query.minPrice;
    if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
  }
  if (query.featured !== undefined) where.isFeatured = query.featured;
  return where;
}

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: 'asc' } },
  variants: { where: { isActive: true }, include: { inventory: true } },
  inventory: true,
  tags: true,
};

function withRating(rows) {
  return rows;
}

// Public listing — server-driven, URL-synced filters live in the client.
// Staff callers may pass staff=true to include drafts (permission-checked).
productsRouter.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const q = req.query;
  const isStaff = req.user && (req.user.roles || []).some((r) => r.role.name !== 'CUSTOMER');
  const where = publicWhere(q, Boolean(q.staff) && isStaff);
  let orderBy = { createdAt: 'desc' };
  if (q.sort === 'price_asc') orderBy = { price: 'asc' };
  if (q.sort === 'price_desc') orderBy = { price: 'desc' };
  if (q.sort === 'newest') orderBy = { createdAt: 'desc' };
  if (q.sort === 'popularity') orderBy = { orderItems: { _count: 'desc' } };

  let products = await prisma.product.findMany({
    where, include: productInclude, orderBy,
    skip: (q.page - 1) * q.perPage, take: q.perPage,
  });
  if (q.inStock) {
    products = products.filter((p) => {
      const total = p.inventory.reduce((s, i) => s + (i.quantity - i.reserved), 0);
      const variantTotal = p.variants.reduce((s, v) => s + v.inventory.reduce((a, i) => a + (i.quantity - i.reserved), 0), 0);
      return total + variantTotal > 0;
    });
  }
  const total = await prisma.product.count({ where });
  res.json({ products: withRating(products), total, page: q.page, perPage: q.perPage });
}));

// Search suggestions (names + categories, real catalog data).
productsRouter.get('/suggest', validate({ query: z.object({ q: z.string().min(1).max(100) }) }), asyncHandler(async (req, res) => {
  const q = req.query.q;
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'PUBLISHED', name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, slug: true, price: true, salePrice: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } },
      take: 8,
    }),
    prisma.category.findMany({
      where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, slug: true },
      take: 5,
    }),
  ]);
  res.json({ products, categories });
}));

productsRouter.get('/:slug', asyncHandler(async (req, res) => {
  // Resolve by slug; fall back to id so the admin editor can load by id.
  let product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: {
      ...productInclude,
      reviews: { where: { isApproved: true }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!product) {
    product = await prisma.product.findUnique({
      where: { id: req.params.slug },
      include: {
        ...productInclude,
        reviews: { where: { isApproved: true }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  }
  if (!product) throw notFound('Product not found');
  const isStaff = req.user && (req.user.roles || []).some((r) => r.role.name !== 'CUSTOMER');
  if (product.status !== 'PUBLISHED' && !isStaff) throw notFound('Product not found');
  const related = await prisma.product.findMany({
    where: { status: 'PUBLISHED', categoryId: product.categoryId, id: { not: product.id } },
    include: { images: { take: 1, orderBy: { sortOrder: 'asc' } }, category: { select: { name: true, slug: true } } },
    take: 8,
  });
  const approved = product.reviews;
  const avgRating = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : null;
  res.json({ product, related, avgRating, reviewCount: approved.length });
}));

// ---- Admin CRUD (permission-gated) ----
productsRouter.post('/', requireAuth, requirePermission('products:write'), validate({ body: productInput }), asyncHandler(async (req, res) => {
  const d = req.body;
  const slug = d.slug || slugify(d.name);
  const category = await prisma.category.findUnique({ where: { id: d.categoryId } });
  if (!category) throw badRequest('Category not found');
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        name: d.name, slug, shortDescription: d.shortDescription, description: d.description,
        sku: d.sku, barcode: d.barcode, categoryId: d.categoryId, brandId: d.brandId || null,
        status: d.status, isFeatured: d.isFeatured, price: d.price, salePrice: d.salePrice,
        weightGrams: d.weightGrams, seoTitle: d.seoTitle, seoDescription: d.seoDescription,
        publishAt: d.publishAt ? new Date(d.publishAt) : null,
        tags: { create: d.tags.map((tag) => ({ tag })) },
        images: { create: d.images.map((img, i) => ({ ...img, sortOrder: i })) },
        variants: { create: d.variants.map((v) => ({ name: v.name, sku: v.sku, price: v.price, salePrice: v.salePrice })) },
      },
    });
    const baseInv = await tx.inventory.create({ data: { productId: p.id, variantId: null, quantity: d.stock, reserved: 0 } });
    void baseInv;
    for (const v of d.variants) {
      const created = await tx.productVariant.findUnique({ where: { sku: v.sku } });
      if (created) await tx.inventory.create({ data: { productId: p.id, variantId: created.id, quantity: v.stock, reserved: 0 } });
    }
    return p;
  });
  await auditLog({ actorId: req.user.id, action: 'product.created', entity: 'Product', entityId: product.id, ipAddress: req.ip });
  res.status(201).json({ product });
}));

productsRouter.put('/:id', requireAuth, requirePermission('products:write'), validate({ body: productInput.partial() }), asyncHandler(async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Product not found');
  const d = req.body;
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...(d.name && { name: d.name }),
      ...(d.slug && { slug: d.slug }),
      ...(d.shortDescription !== undefined && { shortDescription: d.shortDescription }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.sku && { sku: d.sku }),
      ...(d.categoryId && { categoryId: d.categoryId }),
      ...(d.brandId !== undefined && { brandId: d.brandId }),
      ...(d.status && { status: d.status }),
      ...(d.isFeatured !== undefined && { isFeatured: d.isFeatured }),
      ...(d.price !== undefined && { price: d.price }),
      ...(d.salePrice !== undefined && { salePrice: d.salePrice }),
      ...(d.seoTitle !== undefined && { seoTitle: d.seoTitle }),
      ...(d.seoDescription !== undefined && { seoDescription: d.seoDescription }),
    },
  });
  await auditLog({ actorId: req.user.id, action: 'product.updated', entity: 'Product', entityId: product.id, ipAddress: req.ip });
  res.json({ product });
}));

productsRouter.delete('/:id', requireAuth, requirePermission('products:delete'), asyncHandler(async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Product not found');
  // Safe retention: archive instead of hard delete when order history exists.
  const orderCount = await prisma.orderItem.count({ where: { productId: req.params.id } });
  if (orderCount > 0) {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { status: 'ARCHIVED' } });
    await auditLog({ actorId: req.user.id, action: 'product.archived', entity: 'Product', entityId: product.id, ipAddress: req.ip });
    return res.json({ product, archived: true, reason: 'Product has order history; archived instead of deleted.' });
  }
  await prisma.product.delete({ where: { id: req.params.id } });
  await auditLog({ actorId: req.user.id, action: 'product.deleted', entity: 'Product', entityId: req.params.id, ipAddress: req.ip });
  res.json({ ok: true });
}));
