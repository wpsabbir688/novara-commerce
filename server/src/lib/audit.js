import { prisma } from '../db/prisma.js';

export async function auditLog({ actorId = null, action, entity, entityId = null, details = null, ipAddress = null }) {
  try {
    await prisma.auditLog.create({ data: { actorId, action, entity, entityId, details, ipAddress } });
  } catch (err) {
    // Audit logging must never break the business operation it records.
    console.error('audit log failed', err.message);
  }
}
