import { NextResponse } from 'next/server';
import { DEMO_EMAIL } from '@/lib/demo';
import { demoEnabled, ensureDemoAccount } from '@/lib/demoAccount';

export const runtime = 'nodejs';
// The answer depends on runtime env and database state, so it must never be
// captured at build time.
export const dynamic = 'force-dynamic';

/** Whether the login page should offer the demo button. */
export async function GET() {
  return NextResponse.json({ enabled: demoEnabled(), email: DEMO_EMAIL });
}

/** Create or repair the demo account, then hand back its credentials. */
export async function POST() {
  if (!demoEnabled()) {
    return NextResponse.json(
      { error: 'The demo account is disabled on this deployment.' },
      { status: 403 }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'DATABASE_URL is not set, so the demo account cannot be created.' },
      { status: 500 }
    );
  }
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json(
      { error: 'NEXTAUTH_SECRET is not set — sign-in cannot work until it is.' },
      { status: 500 }
    );
  }

  try {
    const result = await ensureDemoAccount();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[demo account error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
