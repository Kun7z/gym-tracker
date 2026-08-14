import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { TEST_DATABASE_URL } from './test-db';

export default function globalSetup(): void {
  const backendDir = path.resolve(__dirname, '..');

  execSync(
    `docker exec gymtracker-postgres psql -U gymtracker -d postgres -c "CREATE DATABASE gymtracker_test" || true`,
    { stdio: 'ignore' },
  );

  execSync(`DATABASE_URL="${TEST_DATABASE_URL}" npx prisma migrate deploy`, {
    cwd: backendDir,
    stdio: 'inherit',
  });
}
