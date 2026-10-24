import argon2 from 'argon2';
import { prisma } from '../src/db/prisma.js';

export async function truncateAll() {
  const tables = [
    'InventoryMovement', 'Inventory', 'CouponRedemption', 'OrderNote', 'OrderStatusHistory',
    'Shipment', 'PaymentEvent', 'Payment', 'OrderItem', 'Order', 'CartItem', 'Cart',
    'WishlistItem', 'Wishlist', 'ReviewModeration', 'Review', 'ProductTag', 'ProductImage',
    'ProductVariant', 'Product', 'CouponProduct', 'CouponCategory', 'Coupon', 'Banner',
    'HomepageSection', 'Address', 'PasswordReset', 'EmailVerification', 'Session',
    'UserRole', 'AuditLog', 'Notification', 'Category', 'Brand', 'StoreSetting',
    'RolePermission', 'Permission', 'Role', 'User',
  ];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE;`);
  }
}

export async function makeUser({ email, password = 'TestPass123', name = 'Test', role = 'CUSTOMER' }) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.create({ data: { name, email, passwordHash, emailVerifiedAt: new Date() } });
  if (role !== 'CUSTOMER') {
    let roleRow = await prisma.role.findUnique({ where: { name: role } });
    if (!roleRow) roleRow = await prisma.role.create({ data: { name: role } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleRow.id } });
  } else {
    let roleRow = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
    if (!roleRow) roleRow = await prisma.role.create({ data: { name: 'CUSTOMER' } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleRow.id } });
  }
  return user;
}

export async function makeProduct({ name = 'Test Product', price = 100000, stock = 10, status = 'PUBLISHED' } = {}) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const category = await prisma.category.upsert({
    where: { slug: 'test-category' },
    create: { name: 'Test Category', slug: 'test-category' },
    update: {},
  });
  const product = await prisma.product.create({
    data: { name, slug: `${slug}-${Date.now()}`, sku: `T-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, categoryId: category.id, status, price },
  });
  await prisma.inventory.create({ data: { productId: product.id, variantId: null, quantity: stock, reserved: 0 } });
  return product;
}

export async function loginAgent(agent, email, password = 'TestPass123') {
  const res = await agent.post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
