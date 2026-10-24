import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { unauthorized } from '../lib/errors.js';

const COOKIE_NAME = 'novara_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

/** Create a session and set the cookie. Returns the session row. */
export async function createSession(res, userId, { userAgent, ipAddress }) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  res.cookie(COOKIE_NAME, token, sessionCookieOptions());
  return session;
}

export async function destroySession(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * Load the current user from the session cookie (if any) and attach to req.
 * Rotates the session token when it is past half its lifetime.
 */
export async function loadUser(req, res, next) {
  req.user = null;
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next();
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      if (session) await prisma.session.delete({ where: { id: session.id } });
      return next();
    }
    req.user = session.user;
    req.session = session;
    // Rotate past half-life: issue a fresh token, retire the old one.
    if (session.expiresAt.getTime() - Date.now() < SESSION_TTL_MS / 2) {
      const newToken = crypto.randomBytes(32).toString('hex');
      await prisma.$transaction([
        prisma.session.delete({ where: { id: session.id } }),
        prisma.session.create({
          data: {
            userId: session.userId,
            tokenHash: hashToken(newToken),
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          },
        }),
      ]);
      res.cookie(COOKIE_NAME, newToken, sessionCookieOptions());
    } else {
      await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  return next();
}

export function optionalAuth(req, res, next) {
  return loadUser(req, res, next);
}
