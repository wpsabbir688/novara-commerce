// NOVARA Commerce — development seed.
// DEV ONLY. All products are fictional demo data (generic names, placeholder
// images). No real brands, reviews, sales figures, or customer records.
// Run: npm run db:seed   (requires DATABASE_URL; dev admin below is documented
// in README.md and must be changed/removed for any shared environment.)
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/lib/permissions.js';

const prisma = new PrismaClient();
const pic = (seed) => `https://picsum.photos/seed/${seed}/800/800.jpg`;

const CATEGORIES = [
  { name: 'Electronics & Gadgets', slug: 'electronics' },
  { name: 'Fashion & Clothing', slug: 'fashion' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Beauty & Personal Care', slug: 'beauty' },
  { name: 'Lifestyle Accessories', slug: 'accessories' },
  { name: 'Sports & Outdoor', slug: 'sports' },
  { name: 'Books & Stationery', slug: 'books-stationery' },
];

// name, category, price(poisha), salePrice, stock, featured
const PRODUCTS = [
  ['Nova Wireless Earbuds', 'electronics', 349900, 279900, 48, true],
  ['Orbit Smartwatch S2', 'electronics', 599900, null, 30, true],
  ['Volt 65W GaN Charger', 'electronics', 249900, 199900, 120, false],
  ['Echo Bluetooth Speaker', 'electronics', 429900, null, 40, false],
  ['Classic Cotton T-Shirt', 'fashion', 129900, 99900, 200, true],
  ['Denim Everyday Jeans', 'fashion', 249900, null, 90, false],
  ['Linen Summer Shirt', 'fashion', 189900, 149900, 75, false],
  ['Urban Runner Sneakers', 'fashion', 399900, null, 60, true],
  ['Ceramic Tea Set (6 pc)', 'home-kitchen', 289900, null, 35, false],
  ['Cast Iron Skillet 26cm', 'home-kitchen', 349900, 299900, 25, false],
  ['Bamboo Cutting Board', 'home-kitchen', 149900, null, 80, false],
  ['Aloe Daily Face Wash', 'beauty', 89900, 69900, 150, true],
  ['Argan Hair Oil 100ml', 'beauty', 119900, null, 95, false],
  ['Canvas Everyday Tote', 'accessories', 179900, null, 110, false],
  ['Leather Bifold Wallet', 'accessories', 219900, 179900, 70, false],
  ['Trail Running Backpack 30L', 'sports', 459900, null, 45, true],
  ['Pro Yoga Mat 6mm', 'sports', 199900, 159900, 65, false],
  ['Everyday Notebook A5', 'books-stationery', 49900, null, 300, false],
  ['Gel Pen Set (10 pc)', 'books-stationery', 59900, 44900, 250, false],
  ['Hardcover Sketchbook', 'books-stationery', 89900, null, 140, false],
];

async function main() {
  // Roles + permissions
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, create: { key, label: key }, update: {} });
  }
  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({ where: { name: roleName }, create: { name: roleName }, update: {} });
    for (const key of keys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id }, update: {},
      });
    }
  }

  // Dev super admin (documented; change in production).
  const adminHash = await argon2.hash('Novara@123', { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@novara.local' },
    create: { name: 'NOVARA Admin', email: 'admin@novara.local', passwordHash: adminHash, emailVerifiedAt: new Date() },
    update: {},
  });
  const superRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: superRole.id } }, create: { userId: admin.id, roleId: superRole.id }, update: {} });

  // Categories
  const catBySlug = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { ...c, description: `Demo category: ${c.name}`, sortOrder: i, imageUrl: pic(`novara-cat-${c.slug}`) },
      update: {},
    });
    catBySlug[c.slug] = cat;
  }

  // Products (idempotent by SKU)
  for (const [i, p] of PRODUCTS.entries()) {
    const [name, catSlug, price, salePrice, stock, featured] = p;
    const sku = `NV-${String(i + 1).padStart(4, '0')}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const product = await prisma.product.upsert({
      where: { slug },
      create: {
        name, slug, sku, categoryId: catBySlug[catSlug].id, status: 'PUBLISHED', isFeatured: featured,
        price, salePrice, shortDescription: `Demo product: ${name}. Fictional listing for development.`,
        description: `This is a fictional demo product (${name}) used to exercise the NOVARA Commerce storefront, cart, checkout, and admin flows. It is not a real product for sale.`,
        images: { create: [{ url: pic(`novara-${slug}`), altText: name, sortOrder: 0 }] },
      },
      update: {},
    });
    const existingInv = await prisma.inventory.findFirst({ where: { productId: product.id, variantId: null } });
    if (existingInv) {
      await prisma.inventory.update({ where: { id: existingInv.id }, data: { quantity: stock } });
    } else {
      await prisma.inventory.create({ data: { productId: product.id, variantId: null, quantity: stock, reserved: 0, lowThreshold: 5 } });
    }
  }

  // Homepage sections + one hero banner
  const sections = [
    { key: 'hero', title: 'Hero', sortOrder: 1 },
    { key: 'categories', title: 'Shop by Category', sortOrder: 2 },
    { key: 'featured', title: 'Featured Products', sortOrder: 3 },
    { key: 'new_arrivals', title: 'New Arrivals', sortOrder: 4 },
    { key: 'best_sellers', title: 'Best Sellers', sortOrder: 5 },
    { key: 'deals', title: 'Discounted Products', sortOrder: 6 },
  ];
  for (const s of sections) {
    await prisma.homepageSection.upsert({ where: { key: s.key }, create: s, update: {} });
  }
  const hero = await prisma.homepageSection.findUnique({ where: { key: 'hero' } });
  const existingBanner = await prisma.banner.findFirst({ where: { sectionId: hero.id } });
  if (!existingBanner) {
    await prisma.banner.create({
      data: { sectionId: hero.id, title: 'Premium shopping, made for Bangladesh', subtitle: 'Electronics, fashion, home and more — with Cash on Delivery nationwide.', imageUrl: pic('novara-hero'), ctaLabel: 'Shop now', ctaHref: '/shop', sortOrder: 0 },
    });
  }

  // Store settings
  const settings = {
    store: { name: 'NOVARA Commerce', tagline: 'Premium shopping, made for Bangladesh', email: 'support@novara.local', phone: '+8801000000000', currency: 'BDT', timezone: 'Asia/Dhaka' },
    announcement: { text: 'Cash on Delivery available nationwide', dismissible: true, isActive: true },
    shipping: { defaultFee: 8000, freeAbove: 500000, districts: { Dhaka: { fee: 6000, freeAbove: 500000 } } },
    cod: { enabled: true, minOrder: 0, maxOrder: null, districts: null },
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.storeSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  console.log('Seed complete: roles, dev admin (admin@novara.local), 7 categories, 20 fictional products, homepage sections, settings.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
