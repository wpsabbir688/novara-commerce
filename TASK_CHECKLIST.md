# NOVARA Commerce — Implementation Checklist

- [x] Environment: PostgreSQL 16 installed locally, novara_dev / novara_test databases created
- [x] Phase 1 — Foundation: Prisma schema (39 tables), auth/session, validation, logging, lint/test infra
- [x] Phase 2 — Storefront: homepage, catalog, search, filters, product pages (real API data)
- [x] Phase 3 — Auth + customers: register/login/verify/reset, profiles, addresses
- [x] Phase 4 — Cart + COD checkout: server totals, atomic stock, idempotency
- [x] Phase 5 — Admin: dashboard, CRUD, inventory, orders, customers, coupons, settings, RBAC
- [x] Phase 6 — Payments (disabled adapters) + email boundary
- [x] Phase 7 — Tests: 32/32 pass (unit + API integration); client production build passes
- [ ] Phase 8 — Deployment docs (done: Docker Compose, migrations, backup/restore, rollback) + GitHub push

Test results: server `npm test` 32/32 green (2026-10-24). Client `npm run build`
green. Playwright browser E2E + real-device checks NOT run (no browser
automation in the build environment) — recorded as a limitation, not claimed.
