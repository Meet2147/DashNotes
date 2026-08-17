import { NextResponse } from 'next/server';
import { checkDatabase, describeDatabaseUrl } from '@/lib/dbHealth';
import { demoEnabled } from '@/lib/demoAccount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One place to see why auth is failing.
 *
 * Open /api/health in a browser and it names the actual problem — unreachable
 * database, wrong credentials in the connection string, missing tables, missing
 * NEXTAUTH_SECRET — rather than leaving you to infer it from a generic
 * "Invalid email or password" on the login form.
 *
 * Reports presence and shape only. No secret, connection string, hostname, or
 * password is ever included in the response.
 */
export async function GET() {
  const database = await checkDatabase();
  const databaseUrl = describeDatabaseUrl();

  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
    NEXTAUTH_URL: Boolean(process.env.NEXTAUTH_URL),
    PERPLEXITY_API_KEY: Boolean(process.env.PERPLEXITY_API_KEY),
    NODE_ENV: process.env.NODE_ENV ?? 'unknown',
  };

  const problems: string[] = [];
  if (!env.DATABASE_URL) {
    problems.push('DATABASE_URL is not set — sign-in and sign-up cannot work.');
  } else if (!database.ok) {
    problems.push(`Database unreachable (${database.code}): ${database.message}`);
  } else if (database.schemaReady === false) {
    problems.push(`Database reachable but schema is missing (${database.code}): ${database.message}`);
  }
  if (!env.NEXTAUTH_SECRET) {
    problems.push('NEXTAUTH_SECRET is not set — every /api/auth/* route will return 500.');
  }

  // The connection-string note is informational — an internal hostname is
  // perfectly correct when the service sits in the database's region. Promote it
  // to a problem only when the database is actually unreachable, where it is the
  // most likely cause. Otherwise a healthy deploy would report itself unhealthy.
  if (!database.ok && databaseUrl.style === 'render-internal' && databaseUrl.note) {
    problems.push(databaseUrl.note);
  }
  if (databaseUrl.present && !databaseUrl.style) {
    problems.push(databaseUrl.note ?? 'DATABASE_URL could not be parsed.');
  }

  const ok = problems.length === 0;

  return NextResponse.json(
    {
      ok,
      authShouldWork: database.ok && database.schemaReady === true && env.NEXTAUTH_SECRET,
      problems,
      database,
      databaseUrl,
      env,
      demoAccountEnabled: demoEnabled(),
    },
    { status: ok ? 200 : 503 }
  );
}
