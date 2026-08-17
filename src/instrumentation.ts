export const runtime = 'nodejs';

import { execFileSync } from 'child_process';
import path from 'path';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const prismaBin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');

    // The CLI reads DATABASE_URL straight from the environment, so it misses the
    // sslmode normalisation lib/prisma.ts applies to the client. Apply it here
    // too, or schema push could fail on a connection the app itself can make.
    const { normalizeDatabaseUrl } = await import('./lib/databaseUrl');
    const normalized = normalizeDatabaseUrl(process.env.DATABASE_URL);
    if (normalized) process.env.DATABASE_URL = normalized;

    try {
      console.log('[startup] Running prisma db push...');
      execFileSync(prismaBin, ['db', 'push', '--accept-data-loss'], {
        stdio: 'inherit',
        env: process.env,
      });
      console.log('[startup] DB schema synced.');
    } catch (err) {
      console.error('[startup] prisma db push failed:', err);
    }
  }
}
