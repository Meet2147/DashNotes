'use client';

import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import NotesList from '@/components/NotesList';
import Editor from '@/components/Editor';
import { useAppStore } from '@/store/useAppStore';

export default function Home() {
  const { darkMode, mobilePanel } = useAppStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Check system preference on first mount
  useEffect(() => {
    const stored = localStorage.getItem('dashnotes-app-store');
    if (!stored) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      {/* Sidebar — always visible on desktop, hidden on mobile */}
      <div className="hidden md:flex flex-col flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar panel */}
      <div
        className={`
          flex-col flex-shrink-0 w-full
          ${mobilePanel === 'sidebar' ? 'flex' : 'hidden'}
          md:hidden
        `}
      >
        <Sidebar />
      </div>

      {/* Notes List */}
      <div
        className={`
          flex-col flex-shrink-0 w-full md:w-72 lg:w-80
          ${mobilePanel === 'notes' ? 'flex' : 'hidden md:flex'}
        `}
      >
        <NotesList />
      </div>

      {/* Editor */}
      <div
        className={`
          flex-1 flex-col min-w-0
          ${mobilePanel === 'editor' ? 'flex' : 'hidden md:flex'}
        `}
      >
        <Editor />
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex z-50">
        <MobileNavBtn
          label="Notes"
          active={mobilePanel === 'notes'}
          onClick={() => useAppStore.getState().setMobilePanel('notes')}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </MobileNavBtn>
        <MobileNavBtn
          label="Write"
          active={mobilePanel === 'editor'}
          onClick={() => useAppStore.getState().setMobilePanel('editor')}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        </MobileNavBtn>
        <MobileNavBtn
          label="Menu"
          active={mobilePanel === 'sidebar'}
          onClick={() => useAppStore.getState().setMobilePanel('sidebar')}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </MobileNavBtn>
      </nav>
    </div>
  );
}

function MobileNavBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
        active ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-gray-500'
      }`}
    >
      {children}
      {label}
    </button>
  );
}
