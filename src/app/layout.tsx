import type { Metadata } from 'next';
import { DM_Sans, DM_Mono } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import { StoreHydration } from '@/components/StoreHydration';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'FlowCraft — AI Agent Orchestration',
  description: 'Build AI automation workflows without writing code.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="font-[family-name:var(--font-dm-sans)] antialiased" suppressHydrationWarning>
        <StoreHydration />
        {children}
      </body>
    </html>
  );
}
