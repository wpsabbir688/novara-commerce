// Permission keys and the role matrix (seeded in prisma/seed.js).
// Authorization is enforced server-side on every protected route; the client
// only hides UI. Super Admin holds every permission.

export const PERMISSIONS = [
  'products:read', 'products:write', 'products:delete',
  'categories:read', 'categories:write',
  'brands:read', 'brands:write',
  'inventory:read', 'inventory:write',
  'orders:read', 'orders:write', 'orders:cancel', 'orders:refund',
  'customers:read', 'customers:write',
  'coupons:read', 'coupons:write',
  'content:read', 'content:write',
  'settings:read', 'settings:write',
  'reports:read', 'reports:export',
  'staff:read', 'staff:write',
  'reviews:moderate',
];

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: PERMISSIONS,
  STORE_MANAGER: PERMISSIONS.filter((p) => !p.startsWith('staff:') && p !== 'settings:write'),
  PRODUCT_MANAGER: ['products:read', 'products:write', 'categories:read', 'categories:write', 'brands:read', 'brands:write', 'inventory:read', 'inventory:write', 'content:read'],
  ORDER_MANAGER: ['orders:read', 'orders:write', 'orders:cancel', 'orders:refund', 'inventory:read', 'customers:read', 'reports:read'],
  SUPPORT_AGENT: ['orders:read', 'customers:read', 'reviews:moderate'],
  CUSTOMER: [],
};

export function userHasPermission(user, permission) {
  if (!user) return false;
  const roles = user.roles?.map((r) => r.role.name) || [];
  if (roles.includes('SUPER_ADMIN')) return true;
  return roles.some((role) => (ROLE_PERMISSIONS[role] || []).includes(permission));
}

export function userIsStaff(user) {
  if (!user) return false;
  return (user.roles || []).some((r) => r.role.name !== 'CUSTOMER');
}
