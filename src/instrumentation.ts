export const runtime = 'nodejs';

import { execFileSync } from 'child_process';
import path from 'path';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const prismaBin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
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
