/**
 * Shared demo-account credentials.
 *
 * Constants only — safe to import from client components. The enable/disable
 * gate and the account creation live in demoAccount.ts, which is server-only.
 *
 * Deliberately NOT a NEXT_PUBLIC_ flag: those are inlined into the bundle at
 * build time, so a value set in a hosting dashboard after the build never takes
 * effect. The login page asks the server whether the demo is available instead
 * (GET /api/demo), which is correct no matter how the environment is configured.
 */

export const DEMO_EMAIL = 'test@dashnotes.app';
export const DEMO_PASSWORD = 'DashNotes@123';
