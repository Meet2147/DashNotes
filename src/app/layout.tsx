import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistration from './sw-register';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'DashNotes – Beautiful Notes & Journal',
  description: 'A fast, offline-first notes app. Write rich notes, organize with collections, browse by calendar.',
  manifest: '/manifest.json',
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
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="h-screen overflow-hidden antialiased font-sans bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
