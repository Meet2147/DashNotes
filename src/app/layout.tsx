import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SessionProviderWrapper from './SessionProviderWrapper';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'DashNotes – AI-Powered Learning Notebook',
  description: 'A Notion-style block editor meets Aria AI tutor. Write notes, generate flashcards, take quizzes — learn smarter with DashNotes.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon-192.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DashNotes',
  },
};

export const viewport: Viewport = {
  themeColor: '#7C3AED',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=6" />
        <link rel="apple-touch-icon" href="/icon-192.svg?v=6" />
      </head>
      {/*
        No overflow-hidden here: body overflow propagates to the viewport, which
        made every page taller than the screen impossible to scroll by wheel or
        touch (the handwriting page and the landing page both were). The notes
        app's fixed three-panel layout doesn't rely on it — /app pins itself with
        its own h-screen overflow-hidden container.
      */}
      <body className="min-h-screen antialiased font-sans bg-white text-gray-900">
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
