'use client';

import { useState } from 'react';
import { X, Sparkles, Zap, Check, Loader2 } from 'lucide-react';

interface UpgradeModalProps {
  onClose: () => void;
  userEmail: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const PRO_FEATURES = [
  'Unlimited AI requests (Aria tutor)',
  'Generate flashcard decks instantly',
  'Quiz yourself on any note',
  'AI summaries on demand',
  'Priority support',
];

type PlanType = 'monthly' | 'annual';

export default function UpgradeModal({ onClose, userEmail }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [planType, setPlanType] = useState<PlanType>('monthly');

  const handleUpgrade = async () => {
    setLoading(true);
    setError('');

    try {
      const ok = await loadRazorpay();
      if (!ok) { setError('Failed to load payment. Check your connection.'); setLoading(false); return; }

      const res = await fetch('/api/razorpay/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Failed to create subscription.');
        setLoading(false);
        return;
      }

      const { subscription_id } = await res.json();
      const description = planType === 'annual'
        ? 'DashNotes Pro — Annual'
        : 'DashNotes Pro — Monthly';

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id,
        name: 'DashNotes',
        description,
        image: '/icon-192.png',
        prefill: { email: userEmail },
        theme: { color: '#7C3AED' },
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          if (verifyRes.ok) {
            onClose();
            window.location.reload();
          } else {
            setError('Payment verified but upgrade failed. Contact support.');
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.open();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-violet-600 to-purple-700 px-6 pt-8 pb-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={20} className="text-yellow-300" />
            <span className="text-sm font-medium text-violet-200">DashNotes Pro</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Unlock unlimited AI</h2>
          <p className="text-violet-200 text-sm">You&apos;ve used all 20 free AI requests this month.</p>

          {/* Plan toggle */}
          <div className="mt-4 flex rounded-xl bg-white/10 p-1 gap-1">
            <button
              onClick={() => setPlanType('monthly')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                planType === 'monthly'
                  ? 'bg-white text-violet-700'
                  : 'text-violet-200 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPlanType('annual')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                planType === 'annual'
                  ? 'bg-white text-violet-700'
                  : 'text-violet-200 hover:text-white'
              }`}
            >
              Annual
              <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                Save 37%
              </span>
            </button>
          </div>

          <div className="mt-3 flex items-baseline gap-1">
            {planType === 'monthly' ? (
              <>
                <span className="text-4xl font-bold">₹199</span>
                <span className="text-violet-200">/month</span>
              </>
            ) : (
              <>
                <span className="text-4xl font-bold">₹1,499</span>
                <span className="text-violet-200">/year</span>
              </>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="px-6 py-5">
          <ul className="space-y-3 mb-6">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center">
                  <Check size={12} className="text-violet-600" />
                </span>
                {f}
              </li>
            ))}
          </ul>

          {error && (
            <p className="text-sm text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold transition-colors"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Processing…</>
            ) : (
              <><Zap size={16} /> Upgrade to Pro</>
            )}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            Cancel anytime · Secured by Razorpay
          </p>
        </div>
      </div>
    </div>
  );
}
