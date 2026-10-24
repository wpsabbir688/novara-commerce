// Vitest global setup: point Prisma at the test database and deploy migrations.
// Requires the Prisma schema-engine binary env var (see server/scripts/setup-engines.sh).
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://novara:novara_dev@localhost:5432/novara_test';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';

const engine = `${root}/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x`;
execSync('npx prisma migrate deploy', {
  cwd: root,
  stdio: 'pipe',
  env: { ...process.env, PRISMA_SCHEMA_ENGINE_BINARY: engine },
});
