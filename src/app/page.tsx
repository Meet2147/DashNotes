'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles, LayoutGrid, ArrowRight, Brain, Zap } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (session) {
      router.replace('/app');
    } else {
      setChecking(false);
    }
  }, [session, status, router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-violet-950 to-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
            <BookOpen size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">OpenNote</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/10"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-900/50 border border-violet-700/50 text-violet-300 text-sm mb-8">
          <Sparkles size={14} />
          Powered by Claude AI
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
          The notebook that{' '}
          <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            thinks with you
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          A Notion-style block editor meets Claude AI tutor. Write notes, then let Feynman AI help you truly understand — with Socratic dialogue, flashcards, and quizzes.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-xl text-base font-semibold transition-all shadow-lg shadow-violet-900/50 hover:shadow-violet-800/50 hover:scale-105"
          >
            Get started free
            <ArrowRight size={18} />
          </Link>
          <span className="text-gray-500 text-sm">No credit card required</span>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<LayoutGrid className="text-violet-400" size={24} />}
            iconBg="bg-violet-900/50"
            title="Block Editor"
            description="Notion-style slash commands for paragraphs, headings, lists, code, quotes, and more. Rich, structured notes without the complexity."
          />
          <FeatureCard
            icon={<Brain className="text-cyan-400" size={24} />}
            iconBg="bg-cyan-900/50"
            title="Feynman AI Tutor"
            description="Chat with Feynman, your personal AI tutor. It reads your notes and uses the Socratic method to guide you toward deep understanding."
          />
          <FeatureCard
            icon={<Zap className="text-amber-400" size={24} />}
            iconBg="bg-amber-900/50"
            title="Flashcards & Quizzes"
            description="Auto-generate flip-card flashcard decks and multiple-choice quizzes from your notes in one click. Study smarter, not harder."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="bg-gradient-to-r from-violet-900/60 to-cyan-900/60 border border-violet-700/30 rounded-3xl p-10">
          <h2 className="text-3xl font-bold mb-4">Start learning smarter today</h2>
          <p className="text-gray-400 mb-8">
            Free plan includes 20 AI requests per month. No credit card needed.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 px-8 py-4 rounded-xl text-base font-semibold transition-all"
          >
            Create free account
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-gray-600 text-sm">
        <p>© 2026 OpenNote. Built with Next.js + Claude AI.</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  iconBg,
  title,
  description,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition-colors">
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="font-semibold text-white text-lg mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
