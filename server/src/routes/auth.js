import crypto from 'node:crypto';
import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { validate } from '../middleware/validate.js';
import { createSession, destroySession, hashToken, requireAuth } from '../middleware/auth.js';
import { authLimiter, sensitiveLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors.js';
import { normalizeBdPhone } from '../lib/phone.js';
import { sendMail } from '../lib/email.js';
import { auditLog } from '../lib/audit.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().optional(),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const resetRequestSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ token: z.string().min(10), password: z.string().min(8).max(128) });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) });

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    emailVerifiedAt: user.emailVerifiedAt,
    roles: (user.roles || []).map((r) => r.role.name),
  };
}

async function assignRole(userId, roleName) {
  const role = await prisma.role.upsert({
    where: { name: roleName },
    create: { name: roleName },
    update: {},
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, roleId: role.id },
    update: {},
  });
}

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const normalizedPhone = phone ? normalizeBdPhone(phone) : null;
  if (phone && !normalizedPhone) throw badRequest('Invalid Bangladeshi phone number');
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])] } });
  if (existing) throw conflict('An account with this email or phone already exists');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: { name, email, passwordHash, phone: normalizedPhone },
    include: { roles: { include: { role: true } } },
  });
  await assignRole(user.id, 'CUSTOMER');
  // Email verification token (logged in dev; real provider sends it when configured)
  const rawToken = crypto.randomBytes(32).toString('hex');
  await prisma.emailVerification.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  await sendMail({ to: email, subject: 'Verify your NOVARA account', text: `Your verification token: ${rawToken}` });
  await createSession(res, user.id, { userAgent: req.headers['user-agent'], ipAddress: req.ip });
  await auditLog({ actorId: user.id, action: 'user.registered', entity: 'User', entityId: user.id, ipAddress: req.ip });
  const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: { roles: { include: { role: true } } } });
  res.status(201).json({ user: publicUser(fresh) });
}));

authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
  if (!user || !user.isActive) throw unauthorized('Invalid email or password');
  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw unauthorized('Invalid email or password');
  await createSession(res, user.id, { userAgent: req.headers['user-agent'], ipAddress: req.ip });
  await auditLog({ actorId: user.id, action: 'user.login', entity: 'User', entityId: user.id, ipAddress: req.ip });
  res.json({ user: publicUser(user) });
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
}));

authRouter.get('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) throw badRequest('Verification token required');
  const record = await prisma.emailVerification.findUnique({ where: { tokenHash: hashToken(String(token)) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw badRequest('Invalid or expired verification token');
  await prisma.$transaction([
    prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  res.json({ ok: true });
}));

authRouter.post('/request-password-reset', sensitiveLimiter, validate({ body: resetRequestSchema }), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  // Always return ok to avoid account enumeration.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await sendMail({ to: user.email, subject: 'Reset your NOVARA password', text: `Your password reset token: ${rawToken}` });
  }
  res.json({ ok: true });
}));

authRouter.post('/reset-password', sensitiveLimiter, validate({ body: resetSchema }), asyncHandler(async (req, res) => {
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(req.body.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw badRequest('Invalid or expired reset token');
  const passwordHash = await argon2.hash(req.body.password, { type: argon2.argon2id });
  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  res.json({ ok: true });
}));

authRouter.post('/change-password', requireAuth, validate({ body: changePasswordSchema }), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const ok = await argon2.verify(user.passwordHash, req.body.currentPassword);
  if (!ok) throw unauthorized('Current password is incorrect');
  const passwordHash = await argon2.hash(req.body.newPassword, { type: argon2.argon2id });
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId: req.user.id, NOT: { id: req.session?.id } } }),
  ]);
  res.json({ ok: true });
}));

authRouter.get('/sessions', requireAuth, asyncHandler(async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user.id },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true, expiresAt: true },
  });
  res.json({ sessions });
}));

authRouter.delete('/sessions/:id', requireAuth, asyncHandler(async (req, res) => {
  const session = await prisma.session.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!session) throw notFound('Session not found');
  await prisma.session.delete({ where: { id: session.id } });
  res.json({ ok: true });
}));
