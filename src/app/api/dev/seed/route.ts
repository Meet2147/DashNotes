import { NextResponse } from 'next/server';
import { demoEnabled, ensureDemoAccount } from '@/lib/demoAccount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Browser-friendly alias of POST /api/demo — visiting this URL in a tab creates
 * or repairs the demo account and prints its credentials, which is handy when the
 * login page itself is not cooperating.
 *
 * The sample notes and the create/repair logic live in lib/demoAccount.ts so this
 * route and /api/demo cannot drift apart.
 *
 * Set ENABLE_DEMO_LOGIN=false to close it.
 */
export async function GET() {
  if (!demoEnabled()) {
    return NextResponse.json({ error: 'The demo account is disabled.' }, { status: 403 });
  }
  try {
    const result = await ensureDemoAccount();
    return NextResponse.json({
      success: true,
      message: result.created
        ? 'Demo account created with sample notes.'
        : result.passwordReset
          ? 'Demo account already existed; its password has been reset so you can sign in.'
          : 'Demo account is ready.',
      credentials: { email: result.email, password: result.password },
      plan: 'Pro (unlimited AI)',
      notesAdded: result.notesAdded,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[seed error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
