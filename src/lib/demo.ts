/**
 * The shared demo account.
 *
 * Fixed credentials that anyone who can reach the app could use, so this is
 * gated: enabled in development, and in production only when
 * NEXT_PUBLIC_ENABLE_DEMO_LOGIN is explicitly "true". Turn it off before the app
 * has real users — set that variable to "false" and the seed endpoint and the
 * login button both disappear.
 *
 * NEXT_PUBLIC_ is deliberate: the login page needs the flag in the browser to
 * decide whether to show the button, and the seed route needs the same value on
 * the server. One variable, read in both places, so they cannot disagree.
 */

export const DEMO_EMAIL = 'test@dashnotes.app';
export const DEMO_PASSWORD = 'DashNotes@123';

export function demoLoginEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  // Unset: fine locally, off by default once deployed.
  return process.env.NODE_ENV !== 'production';
}
