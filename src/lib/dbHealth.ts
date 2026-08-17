/**
 * Turning database failures into messages a human can act on.
 *
 * Why this exists: next-auth's credentials provider catches anything thrown by
 * authorize() and returns a 401, and the login page used to render every 401 as
 * "Invalid email or password". So an unreachable database, a wrong password in
 * the connection string, and a missing table all displayed as though the user had
 * mistyped their password. That is the single most misleading failure this app
 * had, and it cost several rounds of debugging to find.
 */

import { prisma } from './prisma';

/** Marker prefix so the UI can tell infrastructure failures from bad credentials. */
export const DB_ERROR_PREFIX = 'DatabaseUnavailable';

interface PrismaLikeError {
  code?: string;
  message?: string;
  name?: string;
}

/**
 * Pull the meaningful line out of a Prisma error message.
 *
 * Prisma prefixes messages with a blank line and an "Invalid `prisma.x()`
 * invocation:" preamble, so naively taking the first line yields an empty
 * string. Contains a host:port but never credentials.
 */
function meaningfulLine(raw: string): string {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^Invalid `.*` invocation/.test(l));
  const salient = lines.find((l) =>
    /reach database server|Authentication failed|does not exist|closed the connection|Timed out|denied access/i.test(l)
  );
  return (salient ?? lines[0] ?? 'Unknown database error').slice(0, 240);
}

/**
 * Classify a Prisma failure.
 *
 * Connection failures arrive as PrismaClientInitializationError, which in Prisma
 * 5 carries neither `code` nor `errorCode` — so when no code is present we fall
 * back to matching the message text. Without this, every connection problem was
 * reported as "UNKNOWN" with an empty message, which is no more useful than the
 * "Invalid email or password" it replaced.
 */
export function describeDbError(err: unknown): { code: string; message: string; hint?: string } {
  const e = (err ?? {}) as PrismaLikeError & { errorCode?: string };
  const raw = typeof e.message === 'string' ? e.message : String(err);
  const line = meaningfulLine(raw);

  let code = typeof e.code === 'string' ? e.code : typeof e.errorCode === 'string' ? e.errorCode : '';

  if (!code) {
    if (/reach database server/i.test(raw)) code = 'P1001';
    else if (/Authentication failed|password authentication failed/i.test(raw)) code = 'P1000';
    else if (/database .* does not exist/i.test(raw)) code = 'P1003';
    else if (/closed the connection/i.test(raw)) code = 'P1017';
    else if (/Timed out/i.test(raw)) code = 'P1002';
    else if (/relation .* does not exist|table .* does not exist/i.test(raw)) code = 'P2021';
    else if (e.name === 'PrismaClientInitializationError') code = 'P1001';
    else code = 'UNKNOWN';
  }

  switch (code) {
    case 'P1001':
      return {
        code,
        message: line.replace(/^Can't/, 'Cannot'),
        hint:
          'If DATABASE_URL uses a Render-internal hostname (like dpg-xxxx-a with no domain suffix), it only resolves from a Render service in the same region. Use the External Database URL with ?sslmode=require, or confirm the database is not suspended.',
      };
    case 'P1000':
      return {
        code,
        message: 'The database rejected the username or password in DATABASE_URL.',
        hint: 'Copy the connection string again from the database dashboard — the password may have been rotated.',
      };
    case 'P1003':
      return {
        code,
        message: 'The database named in DATABASE_URL does not exist.',
      };
    case 'P1017':
      return {
        code,
        message: 'The database closed the connection.',
        hint: 'Free-tier databases are suspended when idle or expired. Check its status in the dashboard.',
      };
    case 'P1002':
      return { code, message: 'The database server timed out while connecting.' };
    case 'P2021':
      return {
        code,
        message: 'The database is reachable but the tables are missing.',
        hint: 'Run `prisma db push`. On Render this happens at startup, so check the deploy logs for a failure.',
      };
    default:
      return { code, message: line };
  }
}

export interface DbCheck {
  ok: boolean;
  code?: string;
  message?: string;
  hint?: string;
  /** True when the tables exist as well as the connection working. */
  schemaReady?: boolean;
  userCount?: number;
}

/** Connect, then confirm the schema is actually present. */
export async function checkDatabase(): Promise<DbCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    return { ok: false, ...describeDbError(err) };
  }

  try {
    const userCount = await prisma.user.count();
    return { ok: true, schemaReady: true, userCount };
  } catch (err) {
    const described = describeDbError(err);
    // Connection works, so this is a schema problem rather than a network one.
    return { ok: true, schemaReady: false, ...described };
  }
}

/**
 * Mask a hostname down to something identifiable but not fully published.
 *
 * Render host ids look like `dpg-d8ard9gjs32c739fb3eg-a`, and knowing *which*
 * database the app is actually pointed at is the single most useful fact when
 * auth breaks after a database is replaced — the id alone is useless without
 * credentials, but the first few characters are enough to spot a stale value.
 */
function redactHost(host: string): string {
  const [first, ...rest] = host.split('.');
  const domain = rest.length > 0 ? `.${rest.join('.')}` : '';
  const shown = first.length > 12 ? `${first.slice(0, 8)}\u2026${first.slice(-2)}` : first;
  return `${shown}${domain}`;
}

/**
 * Describe DATABASE_URL's shape without revealing it. The hostname style is the
 * single most common cause of a failure here, and it is not a secret — but the
 * credentials in the string very much are, so they never leave the server.
 */
export function describeDatabaseUrl(): {
  present: boolean;
  style?: 'render-internal' | 'render-external' | 'localhost' | 'other';
  hasSslMode?: boolean;
  /** Partially masked hostname — enough to tell which database this is. */
  host?: string;
  database?: string;
  note?: string;
} {
  const url = process.env.DATABASE_URL;
  if (!url) return { present: false };

  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const hasSslMode = parsed.searchParams.has('sslmode');
    const masked = redactHost(host);
    const database = parsed.pathname.replace(/^\//, '') || undefined;
    const common = { present: true as const, hasSslMode, host: masked, database };

    if (/^dpg-[a-z0-9-]+$/i.test(host)) {
      return {
        ...common,
        style: 'render-internal',
        note: 'Render-internal hostname. Only resolves from a Render service in the same region as the database.',
      };
    }
    if (/\.render\.com$/i.test(host)) {
      return {
        ...common,
        style: 'render-external',
        note: hasSslMode
          ? undefined
          : 'No sslmode in DATABASE_URL; sslmode=require is applied automatically for render.com hosts.',
      };
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return { ...common, style: 'localhost' };
    }
    return { ...common, style: 'other' };
  } catch {
    return { present: true, note: 'DATABASE_URL is not a valid URL.' };
  }
}
