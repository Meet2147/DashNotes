/**
 * Connection-string normalisation. Pure and dependency-free, so it can be
 * imported by the Prisma client, by instrumentation before the schema push, and
 * by tests without dragging the query engine along.
 */

/**
 * Render's managed Postgres requires TLS on its external hostnames, and the
 * connection string the dashboard gives you does not include `sslmode`. Prisma
 * defaults to `sslmode=prefer`, which normally negotiates TLS anyway — but
 * "normally" is doing a lot of work somewhere the failure surfaces as an opaque
 * connection error, so be explicit.
 *
 * Only touches hostnames under render.com, and never overrides an sslmode the
 * caller set deliberately. Localhost, internal Render hostnames (which do not
 * need TLS), and other providers are left exactly as given.
 */
export function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (/\.render\.com$/i.test(url.hostname) && !url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
      return url.toString();
    }
    return raw;
  } catch {
    // Not a parseable URL — hand it over unchanged so Prisma's own error surfaces.
    return raw;
  }
}
