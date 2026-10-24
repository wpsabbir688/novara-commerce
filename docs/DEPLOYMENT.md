# Deployment

## Local development

See README.md quick start. The API runs on port 4000, the client on 5173
(Vite proxies `/api` to the API in development).

## Docker Compose (PostgreSQL only)

```bash
docker compose up -d postgres
```

The compose file provisions PostgreSQL 16 with a persistent volume
(`novara_pgdata`). The API and client are deployed as regular Node processes
or your platform's Node hosting — no container requirement is imposed.

## Migrations

Migrations live in `server/prisma/migrations/` and are applied with:

```bash
cd server
npx prisma migrate deploy   # production-safe: applies pending migrations only
```

Never run `prisma migrate dev` against a shared/production database, and
never edit an applied migration in place — create a new one.

## Environment (production checklist)

- [ ] `NODE_ENV=production`, strong `SESSION_SECRET`, HTTPS everywhere.
- [ ] Cookies: Secure + HttpOnly + SameSite=Lax (automatic in production).
- [ ] CORS: `CLIENT_URL` set to the exact storefront origin.
- [ ] `DATABASE_URL` points at managed PostgreSQL with least-privilege
      credentials; no credentials in git, client bundles, or logs.
- [ ] Payment gateway credentials only after sandbox verification
      (see docs/PAYMENTS_AND_EMAIL.md); unconfigured providers stay disabled.
- [ ] Email provider configured and delivery verified.
- [ ] Change or remove the seed dev admin (`admin@novara.local`).
- [ ] Monitoring + error alerts wired to the structured (pino) logs.

## Backup & restore

```bash
# Backup
pg_dump -U novara -h <host> novara_dev > novara-$(date +%F).sql
# Restore (to a fresh database)
createdb -U novara novara_restore
psql -U novara -h <host> novara_restore < novara-YYYY-MM-DD.sql
```

Verify restoration quarterly: restore to a staging database, run
`prisma migrate status`, boot the API, and confirm `/health` and the
storefront homepage. A backup that has never been restored is not a backup.

## Rollback

1. Deployments are code + migration pairs. To roll back code, redeploy the
   previous release artifact.
2. If the release included a migration, prefer a **forward fix** (new
   migration) over rolling the schema back; destructive rollbacks need a
   reviewed plan because order/payment records must never be lost.
3. After rollback, verify `/health`, login, cart, and a COD checkout on
   staging before reopening production traffic.
4. Keep the previous release artifact available until the new release has
   run clean for at least one full business day.
