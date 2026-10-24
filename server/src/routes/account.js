import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, notFound } from '../lib/errors.js';
import { normalizeBdPhone } from '../lib/phone.js';

export const accountRouter = Router();
accountRouter.use(requireAuth);

const addressInput = z.object({
  label: z.string().max(50).default('Home'),
  fullName: z.string().min(2).max(100),
  phone: z.string().min(1),
  district: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  area: z.string().min(1).max(100),
  addressLine: z.string().min(3).max(300),
  postalCode: z.string().max(20).optional().nullable(),
  isDefault: z.boolean().default(false),
});

accountRouter.get('/addresses', asyncHandler(async (req, res) => {
  const addresses = await prisma.address.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  res.json({ addresses });
}));

accountRouter.post('/addresses', validate({ body: addressInput }), asyncHandler(async (req, res) => {
  const phone = normalizeBdPhone(req.body.phone);
  if (!phone) throw badRequest('Invalid Bangladeshi phone number');
  if (req.body.isDefault) await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
  const address = await prisma.address.create({ data: { ...req.body, phone, userId: req.user.id } });
  res.status(201).json({ address });
}));

accountRouter.put('/addresses/:id', validate({ body: addressInput.partial() }), asyncHandler(async (req, res) => {
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) throw notFound('Address not found');
  if (req.body.phone) {
    const phone = normalizeBdPhone(req.body.phone);
    if (!phone) throw badRequest('Invalid Bangladeshi phone number');
    req.body.phone = phone;
  }
  if (req.body.isDefault) await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
  const address = await prisma.address.update({ where: { id: existing.id }, data: req.body });
  res.json({ address });
}));

accountRouter.delete('/addresses/:id', asyncHandler(async (req, res) => {
  await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ ok: true });
}));

accountRouter.put('/profile', validate({ body: z.object({ name: z.string().min(2).max(100), phone: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const data = { name: req.body.name };
  if (req.body.phone) {
    const phone = normalizeBdPhone(req.body.phone);
    if (!phone) throw badRequest('Invalid Bangladeshi phone number');
    data.phone = phone;
  }
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
}));
