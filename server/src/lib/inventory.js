import { prisma } from '../db/prisma.js';

// Inventory policy (documented in README.md):
// - Order creation RESERVES stock (reserved += qty) inside the order transaction.
// - Cancellation / return / refund RELEASES the reservation (reserved -= qty).
// - Delivery FULFILLS it (quantity -= qty, reserved -= qty).
// - Available stock = quantity - reserved. All checks happen server-side in a
//   transaction; the frontend count is never trusted.
// - Manual adjustments go through adjustStock(), which records a movement row.

export async function getOrCreateInventory(tx, productId, variantId) {
  // Prisma forbids null in compound-unique where inputs, so use findFirst
  // for the base (variant-less) inventory row.
  let inv;
  if (variantId) {
    inv = await tx.inventory.findUnique({ where: { productId_variantId: { productId, variantId } } });
  } else {
    inv = await tx.inventory.findFirst({ where: { productId, variantId: null } });
  }
  if (!inv) {
    inv = await tx.inventory.create({ data: { productId, variantId: variantId || null, quantity: 0, reserved: 0 } });
  }
  return inv;
}

export async function reserveStock(tx, items, orderId) {
  for (const item of items) {
    const inv = await getOrCreateInventory(tx, item.productId, item.variantId);
    const available = inv.quantity - inv.reserved;
    if (available < item.quantity) {
      throw new Error(`INSUFFICIENT_STOCK:${item.productId}`);
    }
    await tx.inventory.update({
      where: { id: inv.id },
      data: { reserved: { increment: item.quantity } },
    });
    await tx.inventoryMovement.create({
      data: { inventoryId: inv.id, delta: 0, reservedDelta: item.quantity, reason: 'order_reserve', orderId },
    });
  }
}

export async function releaseStock(tx, items, orderId, reason = 'order_release') {
  for (const item of items) {
    const inv = await getOrCreateInventory(tx, item.productId, item.variantId);
    const releaseQty = Math.min(item.quantity, inv.reserved);
    if (releaseQty <= 0) continue;
    await tx.inventory.update({ where: { id: inv.id }, data: { reserved: { decrement: releaseQty } } });
    await tx.inventoryMovement.create({
      data: { inventoryId: inv.id, delta: 0, reservedDelta: -releaseQty, reason, orderId },
    });
  }
}

export async function fulfillStock(tx, items, orderId) {
  for (const item of items) {
    const inv = await getOrCreateInventory(tx, item.productId, item.variantId);
    const qty = Math.min(item.quantity, inv.reserved, inv.quantity);
    await tx.inventory.update({
      where: { id: inv.id },
      data: { quantity: { decrement: qty }, reserved: { decrement: Math.min(item.quantity, inv.reserved) } },
    });
    await tx.inventoryMovement.create({
      data: { inventoryId: inv.id, delta: -qty, reservedDelta: -Math.min(item.quantity, inv.reserved), reason: 'order_fulfill', orderId },
    });
  }
}

export async function adjustStock({ productId, variantId, delta, reason, actorId }) {
  return prisma.$transaction(async (tx) => {
    const inv = await getOrCreateInventory(tx, productId, variantId);
    if (inv.quantity + delta < 0) throw new Error('INSUFFICIENT_STOCK');
    const updated = await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { increment: delta } } });
    await tx.inventoryMovement.create({
      data: { inventoryId: inv.id, delta, reservedDelta: 0, reason, actorId },
    });
    return updated;
  });
}

export async function lowStockProducts() {
  const rows = await prisma.inventory.findMany({
    include: { product: { select: { id: true, name: true, slug: true, sku: true } }, variant: { select: { id: true, name: true, sku: true } } },
  });
  return rows.filter((r) => r.quantity - r.reserved <= r.lowThreshold);
}
