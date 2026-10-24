# NOVARA Commerce API — `/api/v1`

Base: `http://localhost:4000/api/v1`. Auth: HttpOnly session cookie.
Envelope: success returns resource JSON; failure returns
`{ error: { code, message } }`. Pagination: `?page=&perPage=` (max 100).

## Public

| Method & route | Description |
|---|---|
| GET /health | Service + DB health (outside /api/v1) |
| GET /public/store | Safe store settings (store, announcement, shipping, COD) |
| GET /public/homepage | Homepage sections, featured, new arrivals, deals, best sellers (real order data) |
| GET /products | Listing: q, category, brand, minPrice, maxPrice, inStock, sort, featured, page |
| GET /products/suggest?q= | Search suggestions (products + categories) |
| GET /products/:slug | Detail incl. approved reviews, avg rating, related products |
| GET /categories | Active category tree |
| GET /brands | Active brands |
| GET /payments/providers | Provider status (configured/enabled — no secrets) |

## Auth & account (authenticated unless noted)

| Method & route | Description |
|---|---|
| POST /auth/register | Create account (CUSTOMER role); email verification token issued |
| POST /auth/login | Session cookie set |
| POST /auth/logout | Session revoked |
| GET /auth/me | Current user |
| GET /auth/verify-email?token= | Verify email |
| POST /auth/request-password-reset | Always returns ok (no enumeration) |
| POST /auth/reset-password | Token + new password; revokes all sessions |
| POST /auth/change-password | Requires current password |
| GET /auth/sessions, DELETE /auth/sessions/:id | Session management |
| GET/POST/PUT/DELETE /account/addresses | Own addresses |
| PUT /account/profile | Own profile |

## Cart & wishlist

| Method & route | Description |
|---|---|
| GET /cart | Current cart (user or guest cookie) with server-computed totals |
| POST /cart/items | Add (server-side stock check) |
| PUT /cart/items/:id | Change quantity (0 removes) |
| DELETE /cart/items/:id | Remove |
| POST /cart/merge | Merge guest cart into user cart (stock-capped) |
| GET/POST/DELETE /wishlist | Authenticated wishlist |

## Checkout & orders

| Method & route | Description |
|---|---|
| POST /checkout/validate | Recompute totals + coupon eligibility (no order created) |
| POST /checkout/orders | Create order: server totals, atomic reservation, coupon lock, idempotency key |
| GET /orders/mine, GET /orders/mine/:id | Own orders only (ownership enforced) |
| POST /orders/mine/:id/cancel | Customer cancel (valid transitions only; releases stock) |
| GET /orders, GET /orders/:id | Staff: list/detail (`orders:read`) |
| POST /orders/:id/status | Staff: status transition (`orders:write`; validates transition map) |
| POST /orders/:id/notes | Staff: internal note |
| GET /payments/orders/:orderId | Payment history (owner or staff) |
| POST /payments/orders/:orderId/cod-collect | Staff: COD collection → PAID (`orders:write`) |
| GET /payments/reconciliation/cod | Staff: COD reconciliation summary |
| POST /webhooks/:provider | Provider callbacks — verified only, never from a success URL |

## Reviews

| Method & route | Description |
|---|---|
| POST /reviews | Verified buyers only; pending moderation |
| GET /reviews/pending | Staff moderation queue (`reviews:moderate`) |
| POST /reviews/:id/moderate | Approve / reject (`reviews:moderate`) |

## Admin (`/admin`, permission-gated)

| Method & route | Permission |
|---|---|
| GET /admin/dashboard | `reports:read` — metrics from live queries |
| GET /admin/users, GET /admin/users/:id | `customers:read` |
| POST /admin/users/:id/roles | `staff:write` |
| POST /admin/users/:id/status | `customers:write` |
| GET /admin/inventory, POST /admin/inventory/adjust | `inventory:read` / `inventory:write` |
| GET /admin/coupons, POST /admin/coupons, PUT /admin/coupons/:id | `coupons:read` / `coupons:write` |
| GET /admin/settings, PUT /admin/settings | `settings:read` / `settings:write` |
| GET /admin/content/sections, PUT /admin/content/sections/:id, POST /admin/content/banners | `content:read` / `content:write` |
| GET /admin/reports/:type.csv | `reports:export` (orders, products, inventory) |
| GET /admin/audit-log | `staff:read` |

Admin product/category/brand CRUD lives under `/products`, `/categories`,
`/brands` with the matching `products:write`, `categories:write`,
`brands:write`, `products:delete` permissions.
