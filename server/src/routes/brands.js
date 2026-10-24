import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { notFound } from '../lib/errors.js';
import { auditLog } from '../lib/audit.js';

export const brandsRouter = Router();

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const brandInput = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().default(true),
});

brandsRouter.get('/', asyncHandler(async (req, res) => {
  const brands = await prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  res.json({ brands });
}));

brandsRouter.post('/', requireAuth, requirePermission('brands:write'), validate({ body: brandInput }), asyncHandler(async (req, res) => {
  const d = req.body;
  const brand = await prisma.brand.create({ data: { ...d, slug: d.slug || slugify(d.name) } });
  await auditLog({ actorId: req.user.id, action: 'brand.created', entity: 'Brand', entityId: brand.id, ipAddress: req.ip });
  res.status(201).json({ brand });
}));

brandsRouter.put('/:id', requireAuth, requirePermission('brands:write'), validate({ body: brandInput.partial() }), asyncHandler(async (req, res) => {
  const existing = await prisma.brand.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Brand not found');
  const brand = await prisma.brand.update({ where: { id: req.params.id }, data: req.body });
  await auditLog({ actorId: req.user.id, action: 'brand.updated', entity: 'Brand', entityId: brand.id, ipAddress: req.ip });
  res.json({ brand });
}));

brandsRouter.delete('/:id', requireAuth, requirePermission('brands:write'), asyncHandler(async (req, res) => {
  const existing = await prisma.brand.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Brand not found');
  await prisma.brand.delete({ where: { id: req.params.id } });
  await auditLog({ actorId: req.user.id, action: 'brand.deleted', entity: 'Brand', entityId: req.params.id, ipAddress: req.ip });
  res.json({ ok: true });
}));
