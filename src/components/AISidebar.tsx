'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Note, ChatMessage, Flashcard, QuizQuestion } from '@/types';
import { X, Send, Loader2, Sparkles, CreditCard, BookOpen, FileText } from 'lucide-react';
import { useSession } from 'next-auth/react';
import FlashcardsModal from './FlashcardsModal';
import QuizModal from './QuizModal';
import UpgradeModal from './UpgradeModal';

interface AISidebarProps {
  note: Note | null;
}

function getNoteText(note: Note | null): string {
  if (!note) return '';
  const content = note.content;
  if (!Array.isArray(content)) return '';

  const extractText = (item: unknown): string => {
    if (typeof item === 'string') return item;
    if (Array.isArray(item)) return item.map(extractText).join(' ');
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      if (obj.text) return String(obj.text);
      if (obj.content) return extractText(obj.content);
      if (obj.children) return extractText(obj.children);
    }
    return '';
  };

  return content.map(extractText).join('\n').trim();
}

export default function AISidebar({ note }: AISidebarProps) {
  const { aiSidebarOpen, toggleAiSidebar } = useAppStore();
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [usage, setUsage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [summary, setSummary] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadUsage = useCallback(async () => {
    const res = await fetch('/api/usage');
    if (res.ok) {
      const data = await res.json();
      setUsage(data.usage);
      setLimit(data.limit);
      setLimitReached(data.usage >= data.limit);
    }
  }, []);

  useEffect(() => {
    if (aiSidebarOpen) loadUsage();
  }, [aiSidebarOpen, loadUsage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || limitReached) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    const noteText = getNoteText(note) || note?.title || '';
    const allMessages = [...messages, userMessage];

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteContent: noteText, messages: allMessages }),
      });

      if (res.status === 429) {
        setLimitReached(true);
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `You've reached your monthly limit of ${limit} AI requests. Upgrade to Pro for unlimited access.`,
        }]);
        setIsStreaming(false);
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to get response');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: updated[updated.length - 1].content + parsed.text,
                  };
                  return updated;
                });
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      setUsage((prev) => prev + 1);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSummarize = async () => {
    if (limitReached || loadingAction) return;
    setLoadingAction('summarize');
    setSummary('');

    const noteText = getNoteText(note);
    if (!noteText) {
      setSummary('No content to summarize yet.');
      setLoadingAction(null);
      return;
    }

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteContent: noteText }),
      });
      if (res.status === 429) { setLimitReached(true); setLoadingAction(null); return; }
      const data = await res.json();
      setSummary(data.summary ?? '');
      setUsage((prev) => prev + 1);
    } catch {
      setSummary('Failed to generate summary.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFlashcards = async () => {
    if (limitReached || loadingAction) return;
    setLoadingAction('flashcards');

    const noteText = getNoteText(note);
    if (!noteText) {
      alert('Add some content to your note first!');
      setLoadingAction(null);
      return;
    }

    try {
      const res = await fetch('/api/ai/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteContent: noteText }),
      });
      if (res.status === 429) { setLimitReached(true); setLoadingAction(null); return; }
      const data = await res.json();
      if (Array.isArray(data)) {
        setFlashcards(data);
        setFlashcardsOpen(true);
        setUsage((prev) => prev + 1);
      }
    } catch {
      alert('Failed to generate flashcards. Try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleQuiz = async () => {
    if (limitReached || loadingAction) return;
    setLoadingAction('quiz');

    const noteText = getNoteText(note);
    if (!noteText) {
      alert('Add some content to your note first!');
      setLoadingAction(null);
      return;
    }

    try {
      const res = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteContent: noteText }),
      });
      if (res.status === 429) { setLimitReached(true); setLoadingAction(null); return; }
      const data = await res.json();
      if (Array.isArray(data)) {
        setQuiz(data);
        setQuizOpen(true);
        setUsage((prev) => prev + 1);
      }
    } catch {
      alert('Failed to generate quiz. Try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  if (!aiSidebarOpen) return null;

  return (
    <>
      <div className="flex flex-col w-full md:w-[360px] h-full border-l border-gray-200 bg-gray-50 flex-shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">Ask Aria</span>
          </div>
          <button
            onClick={toggleAiSidebar}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Usage meter */}
        <div className="px-4 py-2.5 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">Monthly AI requests</span>
            <span className={`text-xs font-semibold ${limitReached ? 'text-red-500' : 'text-gray-700'}`}>
              {usage}/{limit}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                limitReached ? 'bg-red-500' : usage > 15 ? 'bg-amber-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${Math.min((usage / limit) * 100, 100)}%` }}
            />
          </div>
          {limitReached && (
            <button
              onClick={() => setUpgradeOpen(true)}
              className="text-xs text-violet-600 font-medium mt-1.5 hover:underline flex items-center gap-1"
            >
              <Sparkles size={11} /> Upgrade to Pro for unlimited access →
            </button>
          )}
        </div>

        {/* Summary section */}
        {summary && (
          <div className="px-4 py-3 border-b border-gray-200 bg-cyan-50">
            <p className="text-xs font-semibold text-cyan-700 mb-2">Summary</p>
            <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
              {summary}
            </div>
            <button
              onClick={() => setSummary('')}
              className="text-xs text-gray-400 mt-2 hover:text-gray-600"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-cyan-100 flex items-center justify-center mx-auto mb-3">
                <Sparkles size={20} className="text-cyan-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">Hi! I&apos;m Aria</p>
              <p className="text-xs text-gray-400 max-w-[200px] mx-auto">
                Ask me anything about your notes. I&apos;ll help you understand using the Socratic method.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}
              >
                {msg.content}
                {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-4 bg-cyan-500 ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions */}
        <div className="px-3 py-2 border-t border-gray-200 bg-white flex gap-2 flex-wrap">
          <ActionBtn
            onClick={handleSummarize}
            loading={loadingAction === 'summarize'}
            disabled={!!limitReached || !!loadingAction}
            icon={<FileText size={12} />}
          >
            Summarize
          </ActionBtn>
          <ActionBtn
            onClick={handleFlashcards}
            loading={loadingAction === 'flashcards'}
            disabled={!!limitReached || !!loadingAction}
            icon={<CreditCard size={12} />}
          >
            Flashcards
          </ActionBtn>
          <ActionBtn
            onClick={handleQuiz}
            loading={loadingAction === 'quiz'}
            disabled={!!limitReached || !!loadingAction}
            icon={<BookOpen size={12} />}
          >
            Quiz Me
          </ActionBtn>
        </div>

        {/* Input */}
        <div className="px-3 pb-3 bg-white border-t border-gray-100 pt-2">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={limitReached ? 'Monthly limit reached' : 'Ask about your notes...'}
              disabled={isStreaming || limitReached}
              rows={2}
              className="flex-1 resize-none px-3 py-2 text-sm bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50 placeholder-gray-400 text-gray-900"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming || limitReached}
              className="p-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
            >
              {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-center">
            Shift+Enter for new line
          </p>
        </div>
      </div>

      {flashcardsOpen && (
        <FlashcardsModal
          flashcards={flashcards}
          onClose={() => setFlashcardsOpen(false)}
        />
      )}

      {quizOpen && (
        <QuizModal
          questions={quiz}
          onClose={() => setQuizOpen(false)}
        />
      )}

      {upgradeOpen && (
        <UpgradeModal
          userEmail={session?.user?.email ?? ''}
          onClose={() => setUpgradeOpen(false)}
        />
      )}
    </>
  );
}

function ActionBtn({
  children,
  onClick,
  loading,
  disabled,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 transition-colors"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
