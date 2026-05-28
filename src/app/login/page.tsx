'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import DashNotesLogo from '@/components/DashNotesLogo';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (tab === 'signin') {
        const result = await signIn('credentials', { email, password, redirect: false });
        if (result?.error) {
          setError('Invalid email or password');
        } else {
          router.replace('/app');
        }
      } else {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, ref }),
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
    <div className="min-h-screen bg-gradient-to-br from-white via-violet-50 to-indigo-50 flex items-center justify-center p-4">
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

        <div className="bg-white border border-violet-100 rounded-2xl p-8 shadow-lg shadow-violet-100/50">
          {/* Tabs */}
          <div className="flex rounded-xl bg-violet-100 p-1 mb-6">
            <button
              onClick={() => { setTab('signin'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'signin'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-violet-500 hover:text-violet-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'signup'
                  ? 'bg-violet-600 text-white shadow-sm'
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
                  className="w-full pl-9 pr-4 py-3 bg-violet-50 border border-violet-200 text-gray-900 rounded-xl text-sm placeholder-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
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
                  className="w-full pl-9 pr-4 py-3 bg-violet-50 border border-violet-200 text-gray-900 rounded-xl text-sm placeholder-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
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
