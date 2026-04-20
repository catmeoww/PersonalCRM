import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'PersonalCRM',
  description: 'Personal contact manager for parents and professionals',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'PersonalCRM',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#2563eb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-2xl px-4 pt-4 pb-24">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
