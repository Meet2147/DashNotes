'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Loader2, AlertCircle, Play } from 'lucide-react';
import Link from 'next/link';
import DashNotesLogo from '@/components/DashNotesLogo';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo';
import { DB_ERROR_PREFIX } from '@/lib/dbHealth';

/**
 * next-auth reports every failed credentials attempt as a 401, so a genuinely
 * wrong password and an unreachable database arrive identically. auth.ts tags the
 * latter, letting us name the real problem instead of blaming the password.
 */
function describeSignInError(raw: string): string {
  if (raw.startsWith(DB_ERROR_PREFIX)) {
    const detail = raw.slice(DB_ERROR_PREFIX.length).replace(/^:\s*/, '');
    return `${detail || 'The database is unavailable.'} Open /api/health for details — this is not a password problem.`;
  }
  return 'Invalid email or password';
}

type Tab = 'signin' | 'signup';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref') ?? '';
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  // Asked of the server rather than read from a build-time constant, so it is
  // right regardless of when or where the environment was configured.
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/demo')
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => {
        if (!cancelled) setShowDemo(data?.enabled === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * One-click sign-in for testing: make sure the demo account exists (the seed
   * endpoint is idempotent and also fills it with sample notes), then sign in.
   */
  const handleDemoLogin = async () => {
    setError('');
    setSuccessMsg('');
    setDemoLoading(true);
    try {
      // Creates the account, or repairs it if a previous attempt left it in a
      // state where the documented password no longer worked.
      const prepared = await fetch('/api/demo', { method: 'POST' });
      const data = await prepared.json().catch(() => ({}));
      if (!prepared.ok) {
        setError(data.error ?? 'The demo account could not be prepared.');
        return;
      }
      const result = await signIn('credentials', {
        email: data.email ?? DEMO_EMAIL,
        password: data.password ?? DEMO_PASSWORD,
        redirect: false,
      });
      if (result?.error) {
        setError(describeSignInError(result.error));
        return;
      }
      router.replace('/app');
    } catch {
      setError('Could not reach the server. Is it running?');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (tab === 'signin') {
        const result = await signIn('credentials', { email, password, redirect: false });
        if (result?.error) {
          setError(describeSignInError(result.error));
        } else {
          router.replace('/app');
        }
      } else {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The API reads `referralCode`; sending `ref` silently dropped it.
          body: JSON.stringify({ email, password, referralCode: ref || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Sign up failed');
        } else {
          const result = await signIn('credentials', { email, password, redirect: false });
          if (result?.error) {
            setSuccessMsg('Account created! Please sign in.');
            setTab('signin');
          } else {
            router.replace('/app');
          }
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen neu-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <DashNotesLogo size={52} />
            <span className="text-2xl font-bold text-gray-900 tracking-tight">DashNotes</span>
          </Link>
          <p className="text-gray-500 mt-2 text-sm">
            {tab === 'signin' ? 'Welcome back' : 'Create your free account'}
          </p>
        </div>

        <div className="neu-surface rounded-3xl p-8">
          {/* Tabs */}
          <div className="flex rounded-2xl neu-inset p-1.5 mb-6">
            <button
              onClick={() => { setTab('signin'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'signin'
                  ? 'neu-primary text-white'
                  : 'text-violet-500 hover:text-violet-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'signup'
                  ? 'neu-primary text-white'
                  : 'text-violet-500 hover:text-violet-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Success / Error messages */}
          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              {successMsg}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1.5 font-medium">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-9 pr-4 py-3 neu-inset text-gray-900 rounded-xl text-sm placeholder-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-9 pr-4 py-3 neu-inset text-gray-900 rounded-xl text-sm placeholder-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || demoLoading}
              className="w-full py-3 neu-primary disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {showDemo && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-violet-100" />
                <span className="text-xs text-violet-300 font-medium uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-violet-100" />
              </div>

              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading || demoLoading}
                className="w-full py-3 neu-raised disabled:opacity-60 disabled:cursor-not-allowed text-violet-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                {demoLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={15} />}
                {demoLoading ? 'Preparing demo…' : 'Explore the demo account'}
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-2.5 leading-relaxed">
                Signs you straight in with sample notes and unlimited AI credits.
                <br />
                <span className="font-mono">{DEMO_EMAIL}</span> · <span className="font-mono">{DEMO_PASSWORD}</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
