import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, notFound } from '../lib/errors.js';

export const cartRouter = Router();

const GUEST_COOKIE = 'novara_guest';

function getGuestToken(req, res) {
  let token = req.cookies?.[GUEST_COOKIE];
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    res.cookie(GUEST_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' });
  }
  return token;
}

async function findCart(req) {
  if (req.user) {
    return prisma.cart.findFirst({ where: { userId: req.user.id }, orderBy: { updatedAt: 'desc' } });
  }
  const token = req.cookies?.[GUEST_COOKIE];
  if (!token) return null;
  return prisma.cart.findUnique({ where: { guestToken: token } });
}

async function serializeCart(cart) {
  if (!cart) return { items: [], subtotal: 0 };
  const full = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: {
      items: {
        include: {
          product: { include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } },
          variant: true,
        },
        orderBy: { cartId: 'asc' },
      },
    },
  });
  const items = (full?.items || []).map((i) => {
    const unit = i.variant?.salePrice ?? i.variant?.price ?? i.product.salePrice ?? i.product.price;
    return {
      id: i.id, productId: i.productId, variantId: i.variantId, quantity: i.quantity,
      name: i.product.name, slug: i.product.slug, image: i.product.images[0]?.url || null,
      variantName: i.variant?.name || null, unitPrice: unit, lineTotal: unit * i.quantity,
    };
  });
  return { id: cart.id, items, subtotal: items.reduce((s, i) => s + i.lineTotal, 0) };
}

const addSchema = z.object({ productId: z.string().min(1), variantId: z.string().optional().nullable(), quantity: z.number().int().min(1).max(99) });
const updateSchema = z.object({ quantity: z.number().int().min(0).max(99) });

cartRouter.get('/', asyncHandler(async (req, res) => {
  const cart = await findCart(req);
  res.json(await serializeCart(cart));
}));

cartRouter.post('/items', validate({ body: addSchema }), asyncHandler(async (req, res) => {
  const { productId, variantId, quantity } = req.body;
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
  if (!product || product.status !== 'PUBLISHED') throw notFound('Product not found');
  let variant = null;
  if (variantId) {
    variant = product.variants.find((v) => v.id === variantId && v.isActive);
    if (!variant) throw badRequest('Variant not available');
  }
  // Server-side availability check (never trust the client count).
  const inv = variantId ? await prisma.inventory.findUnique({ where: { productId_variantId: { productId, variantId } } }) : await prisma.inventory.findFirst({ where: { productId, variantId: null } });
  const available = inv ? inv.quantity - inv.reserved : 0;
  if (available < quantity) throw badRequest(`Only ${Math.max(available, 0)} unit(s) available`);

  let cart = await findCart(req);
  if (!cart) {
    cart = await prisma.cart.create({ data: req.user ? { userId: req.user.id } : { guestToken: getGuestToken(req, res) } });
  }
  const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId, variantId: variantId || null } });
  const newQty = (existing?.quantity || 0) + quantity;
  if (available < newQty) throw badRequest(`Only ${Math.max(available, 0)} unit(s) available`);
  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } });
  } else {
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, variantId: variantId || null, quantity } });
  }
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  res.status(201).json(await serializeCart(cart));
}));

cartRouter.put('/items/:id', validate({ body: updateSchema }), asyncHandler(async (req, res) => {
  const cart = await findCart(req);
  if (!cart) throw notFound('Cart not found');
  const item = await prisma.cartItem.findFirst({ where: { id: req.params.id, cartId: cart.id } });
  if (!item) throw notFound('Cart item not found');
  if (req.body.quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    const inv = item.variantId ? await prisma.inventory.findUnique({ where: { productId_variantId: { productId: item.productId, variantId: item.variantId } } }) : await prisma.inventory.findFirst({ where: { productId: item.productId, variantId: null } });
    const available = inv ? inv.quantity - inv.reserved : 0;
    if (available < req.body.quantity) throw badRequest(`Only ${Math.max(available, 0)} unit(s) available`);
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: req.body.quantity } });
  }
  res.json(await serializeCart(cart));
}));

cartRouter.delete('/items/:id', asyncHandler(async (req, res) => {
  const cart = await findCart(req);
  if (!cart) throw notFound('Cart not found');
  await prisma.cartItem.deleteMany({ where: { id: req.params.id, cartId: cart.id } });
  res.json(await serializeCart(cart));
}));

// Merge a guest cart into the logged-in user's cart (quantities summed, capped
// at available stock; guest cart is deleted after a successful merge).
cartRouter.post('/merge', asyncHandler(async (req, res) => {
  if (!req.user) throw badRequest('Login required to merge a cart');
  const token = req.cookies?.[GUEST_COOKIE];
  if (!token) return res.json(await serializeCart(await findCart(req)));
  const guestCart = await prisma.cart.findUnique({ where: { guestToken: token }, include: { items: true } });
  if (!guestCart) return res.json(await serializeCart(await findCart(req)));
  let userCart = await prisma.cart.findFirst({ where: { userId: req.user.id }, orderBy: { updatedAt: 'desc' } });
  if (!userCart) userCart = await prisma.cart.create({ data: { userId: req.user.id } });
  for (const item of guestCart.items) {
    const inv = item.variantId ? await prisma.inventory.findUnique({ where: { productId_variantId: { productId: item.productId, variantId: item.variantId } } }) : await prisma.inventory.findFirst({ where: { productId: item.productId, variantId: null } });
    const available = inv ? inv.quantity - inv.reserved : 0;
    const existing = await prisma.cartItem.findFirst({ where: { cartId: userCart.id, productId: item.productId, variantId: item.variantId } });
    const merged = Math.min((existing?.quantity || 0) + item.quantity, Math.max(available, 0));
    if (merged <= 0) continue;
    if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: merged } });
    else await prisma.cartItem.create({ data: { cartId: userCart.id, productId: item.productId, variantId: item.variantId, quantity: merged } });
  }
  await prisma.cart.delete({ where: { id: guestCart.id } });
  res.clearCookie(GUEST_COOKIE, { path: '/' });
  res.json(await serializeCart(userCart));
}));
