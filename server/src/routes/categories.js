import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, notFound } from '../lib/errors.js';
import { auditLog } from '../lib/audit.js';

export const categoriesRouter = Router();

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const categoryInput = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

async function assertNoCycle(categoryId, parentId) {
  let current = parentId;
  const seen = new Set();
  while (current) {
    if (current === categoryId) throw badRequest('Circular parent category is not allowed');
    if (seen.has(current)) break;
    seen.add(current);
    const parent = await prisma.category.findUnique({ where: { id: current }, select: { parentId: true } });
    current = parent?.parentId || null;
  }
}

categoriesRouter.get('/', asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }, _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ categories: categories.filter((c) => !c.parentId) });
}));

categoriesRouter.get('/all', requireAuth, requirePermission('categories:read'), asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  res.json({ categories });
}));

categoriesRouter.post('/', requireAuth, requirePermission('categories:write'), validate({ body: categoryInput }), asyncHandler(async (req, res) => {
  const d = req.body;
  if (d.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: d.parentId } });
    if (!parent) throw badRequest('Parent category not found');
  }
  const category = await prisma.category.create({ data: { ...d, slug: d.slug || slugify(d.name) } });
  await auditLog({ actorId: req.user.id, action: 'category.created', entity: 'Category', entityId: category.id, ipAddress: req.ip });
  res.status(201).json({ category });
}));

categoriesRouter.put('/:id', requireAuth, requirePermission('categories:write'), validate({ body: categoryInput.partial() }), asyncHandler(async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Category not found');
  if (req.body.parentId !== undefined && req.body.parentId) await assertNoCycle(req.params.id, req.body.parentId);
  const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
  await auditLog({ actorId: req.user.id, action: 'category.updated', entity: 'Category', entityId: category.id, ipAddress: req.ip });
  res.json({ category });
}));

categoriesRouter.delete('/:id', requireAuth, requirePermission('categories:write'), asyncHandler(async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id }, include: { _count: { select: { products: true, children: true } } } });
  if (!existing) throw notFound('Category not found');
  if (existing._count.products > 0) throw badRequest('Category has products. Reassign or archive them before deleting.');
  if (existing._count.children > 0) throw badRequest('Category has subcategories. Move or delete them first.');
  await prisma.category.delete({ where: { id: req.params.id } });
  await auditLog({ actorId: req.user.id, action: 'category.deleted', entity: 'Category', entityId: req.params.id, ipAddress: req.ip });
  res.json({ ok: true });
}));
