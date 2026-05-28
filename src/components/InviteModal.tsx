'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Gift, ExternalLink } from 'lucide-react';

interface InviteModalProps {
  onClose: () => void;
}

interface ReferralData {
  code: string;
  referralUrl: string;
  totalReferrals: number;
  convertedReferrals: number;
  totalEarnings: number;
  pendingPayout: number;
}

export default function InviteModal({ onClose }: InviteModalProps) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!data?.referralUrl) return;
    await navigator.clipboard.writeText(data.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-violet-600 to-purple-700 px-6 pt-6 pb-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Gift size={20} className="text-yellow-300" />
            <span className="text-sm font-medium text-violet-200">Referral Program</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Invite friends, earn ₹100</h2>
          <p className="text-violet-200 text-sm">
            Get ₹100 for every friend who upgrades to Pro
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Referral link */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your referral link</p>
            {loading ? (
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 bg-gray-100 rounded-xl text-sm text-gray-600 font-mono truncate">
                  {data?.referralUrl || 'Loading...'}
                </div>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-700 transition-colors flex-shrink-0"
                  title="Copy link"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          {data && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                value={data.totalReferrals}
                label="Invited"
                icon={<Users size={16} className="text-blue-500" />}
              />
              <StatCard
                value={data.convertedReferrals}
                label="Converted"
                icon={<Check size={16} className="text-green-500" />}
              />
              <StatCard
                value={`₹${data.totalEarnings}`}
                label="Earned"
                icon={<Gift size={16} className="text-violet-500" />}
              />
            </div>
          )}

          {/* Payout info */}
          {data && data.pendingPayout > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-800 font-medium">
                ₹{data.pendingPayout} pending payout
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Contact support@dashnotes.app to request payout
              </p>
            </div>
          )}

          {/* Share buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!data?.referralUrl) return;
                const text = `Check out DashNotes — an AI-powered learning notebook! Use my referral link to get started: ${data.referralUrl}`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <ExternalLink size={14} />
              Share on X
            </button>
            <button
              onClick={() => {
                if (!data?.referralUrl) return;
                const text = `Check out DashNotes — an AI-powered learning notebook! Use my link: ${data.referralUrl}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <ExternalLink size={14} />
              Share on WhatsApp
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            Rewards paid out once your referral upgrades to Pro
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  icon,
}: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
