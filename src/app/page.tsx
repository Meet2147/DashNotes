'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sparkles, LayoutGrid, ArrowRight, Brain, Zap } from 'lucide-react';
import DashNotesLogo from '@/components/DashNotesLogo';

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-violet-50 to-indigo-50 text-gray-900">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <DashNotesLogo size={34} />
          <span className="font-bold text-lg tracking-tight text-gray-900">DashNotes</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors px-4 py-2 rounded-lg hover:bg-violet-100"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm shadow-violet-200"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-sm mb-8 font-medium">
          <Sparkles size={14} />
          Powered by Perplexity
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight text-gray-900">
          The notebook that{' '}
          <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
            thinks with you
          </span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          A Notion-style block editor meets Aria AI tutor. Write notes, then let Aria help you truly understand — with Socratic dialogue, flashcards, and quizzes.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-xl text-base font-semibold transition-all shadow-lg shadow-violet-200 hover:scale-105"
          >
            Get started free
            <ArrowRight size={18} />
          </Link>
          <span className="text-gray-400 text-sm">No credit card required</span>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<LayoutGrid className="text-violet-600" size={24} />}
            iconBg="bg-violet-100"
            title="Block Editor"
            description="Notion-style slash commands for paragraphs, headings, lists, code, quotes, and more. Rich, structured notes without the complexity."
          />
          <FeatureCard
            icon={<Brain className="text-indigo-600" size={24} />}
            iconBg="bg-indigo-100"
            title="Aria AI Tutor"
            description="Chat with Aria, your personal AI tutor. She reads your notes and uses the Socratic method to guide you toward deep understanding."
          />
          <FeatureCard
            icon={<Zap className="text-amber-500" size={24} />}
            iconBg="bg-amber-50"
            title="Flashcards & Quizzes"
            description="Auto-generate flip-card flashcard decks and multiple-choice quizzes from your notes in one click. Study smarter, not harder."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="bg-gradient-to-r from-violet-100 to-indigo-100 border border-violet-200 rounded-3xl p-10">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Start learning smarter today</h2>
          <p className="text-gray-500 mb-8">
            Free plan includes 20 AI requests per month. No credit card needed.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-xl text-base font-semibold transition-all shadow-md shadow-violet-200"
          >
            Create free account
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-violet-100 py-8 text-center text-gray-400 text-sm">
        <p>© 2026 DashNotes. Built with Next.js + Perplexity AI.</p>
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
    <div className="bg-white border border-violet-100 rounded-2xl p-6 hover:border-violet-200 hover:shadow-md hover:shadow-violet-100 transition-all">
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 text-lg mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
