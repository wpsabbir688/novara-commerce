# NOVARA Commerce

🌐 **Live demo:** https://soft-brigadeiros-23e415.netlify.app

Premium, full-stack, multi-category eCommerce platform for Bangladesh.
React + Vite frontend (JavaScript/JSX only), Node.js + Express REST API under
`/api/v1`, Prisma ORM + PostgreSQL. BDT currency, Cash on Delivery as a
genuinely working payment method, and disabled-by-default gateway adapters
(SSLCOMMERZ, bKash, Nagad). Admin dashboard under `/admin` with
server-enforced role-based access control.

> **Honesty statement.** Nothing in this repository is faked: dashboard
> metrics come from database queries, best sellers come from real order data,
> reviews appear only after moderation, and payment providers that lack
> credentials or implementation are marked unconfigured and are never offered
> as working payment methods. Seed data is fictional demo data, clearly
> separated from production records.

## Quick start (local development)

Prerequisites: Node.js 20+, PostgreSQL 16 (or `docker compose up postgres`).

```bash
# 1. Database
docker compose up -d postgres
# or use a local PostgreSQL and create databases novara_dev / novara_test

# 2. Server
cd server
cp .env.example .env        # edit DATABASE_URL, SESSION_SECRET
npm install --ignore-scripts
./scripts/setup-engines.sh  # only needed on networks where Prisma's Node
                            # fetch cannot reach binaries.prisma.sh; downloads
                            # engines with curl and prints the PRISMA_*_BINARY
                            # exports to source before prisma commands
eval "$(./scripts/setup-engines.sh)"
npx prisma migrate deploy
npm run db:seed
npm run dev                 # API on http://localhost:4000

# 3. Client (new terminal)
cd client
npm install
npm run dev                 # storefront on http://localhost:5173
```

**Dev admin (seed only, change in production):** `admin@novara.local` /
`Novara@123` — Super Admin.

## Architecture

```
client/   Vite + React 19 + React Router 7 + TanStack Query + React Hook Form + Zod
          + Tailwind v4 + Lucide + Framer Motion. No tokens in localStorage.
server/   Express 4 + Prisma 6 + Zod. Cookie sessions (see below).
          src/routes: auth, products, categories, brands, cart, wishlist,
          checkout, orders, payments (+webhooks), reviews, admin, account, public
          src/lib: money (integer poisha), phone (BD normalization), permissions,
          inventory (reserve/release/fulfill), coupons, shipping, payments, email
```

### Authentication (documented strategy)

- Passwords hashed with **Argon2id**.
- Sessions: a random 32-byte token stored **SHA-256 hashed** in the `Session`
  table; the raw token lives only in an **HttpOnly, SameSite=Lax** cookie
  (`novara_session`, Secure in production), 30-day expiry, rotated past
  half-life. No tokens in localStorage, ever.
- Rate limits on login/register/password-reset. Email verification and
  password-reset tokens are hashed, single-use, expiring.
- Authorization is enforced server-side on every protected route via the
  role/permission matrix (`server/src/lib/permissions.js`). Client-side
  hiding is cosmetic only.

### Inventory policy (documented)

- Order creation **reserves** stock (`reserved += qty`) inside the order
  transaction after a server-side availability check.
- Cancellation / return / refund **releases** the reservation.
- Delivery **fulfills** it (`quantity -= qty, reserved -= qty`).
- Available stock = `quantity - reserved`. Frontend counts are never trusted.
- Manual adjustments go through `POST /api/v1/admin/inventory/adjust` and
  always write an `InventoryMovement` row (audit history).

### Order & payment states

- Order creation ≠ payment received. COD orders start `PENDING / UNPAID`.
- A COD order becomes `PAID` only when authorized staff confirm collection
  (`POST /api/v1/payments/orders/:id/cod-collect`) or a verified gateway
  callback arrives. A success URL never marks an order paid.
- Valid order transitions are enforced server-side
  (`server/src/lib/orderTransitions.js`).
- Checkout is idempotent: repeat submissions with the same `idempotencyKey`
  return the original order, never a duplicate.
- Coupons are validated server-side; usage limits are re-checked under a
  row lock inside the order transaction.

### Money

All amounts are **integer minor units (BDT poisha)**. No floating-point
arithmetic for money anywhere. Display uses `Intl.NumberFormat` (BDT, ৳).

## Payments & email — what is real, what is not

See [docs/PAYMENTS_AND_EMAIL.md](docs/PAYMENTS_AND_EMAIL.md). Summary:

| Provider | Status |
|---|---|
| Cash on Delivery | ✅ Fully working (configurable availability, district limits, min/max, collection + reconciliation) |
| SSLCOMMERZ | ❌ Disabled — no credentials, no implementation; webhook refuses unverified callbacks |
| bKash | ❌ Disabled — same |
| Nagad | ❌ Disabled — same |
| Email | ⚠️ Boundary only — logged in development; provider implementation is a documented TODO |

## API

Endpoint inventory with method, auth, and role requirements:
[docs/API.md](docs/API.md). Interactive exploration: every route returns the
consistent envelope `{ error: { code, message } }` on failure and never
leaks stack traces or database internals.

## Tests

```bash
cd server
npm test   # vitest: unit + API integration (supertest) against novara_test
```

**Test report (2026-10-24, this environment): 32/32 pass** — unit: money,
BD phone, order transitions, coupons, permissions; integration: auth +
catalog, cart + COD checkout (server totals, idempotency, coupon limits,
gateway refusal), orders + payments (customer isolation, transitions,
cancel-release, COD collect, forged callback rejection, dashboard metrics).
Client production build passes (`npm run build` in `client/`).

**Not verified by automated tests:** browser-based end-to-end flows via
Playwright (no browser automation was available in the build environment);
real-device responsive checks; real gateway sandbox verification (no
credentials); real email delivery (no provider configured). These are listed
as known limitations below, not claimed.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Docker Compose for PostgreSQL,
migration workflow (`prisma migrate deploy`), backup/restore procedures,
rollback procedure, and production checklist (HTTPS, Secure cookies, strict
CORS, secrets management).

## Known limitations & next steps

1. **Payment gateways need merchant credentials + official implementation**
   (initiate + server-side validation + webhook verification per provider).
   Until then they stay disabled.
2. **Email needs a provider** (SMTP or transactional API) wired into
   `server/src/lib/email.js`.
3. **Playwright E2E + real-device testing** not run — add when a browser
   environment is available; API-level flows covering the same journeys are
   tested.
4. **Object storage** for uploads is a configuration boundary only; local
   image URLs are used in development.
5. **Single-chunk client bundle** (~672 KB JS, ~203 KB gzip): add route-level
   code splitting before large-scale production use.
6. **SMS/OTP provider** is optional and unconfigured (documented boundary).
7. **Background jobs** (email retries, reservation expiry) are logged
   best-effort hooks, not a queue — add Redis/BullMQ when volume justifies it.
