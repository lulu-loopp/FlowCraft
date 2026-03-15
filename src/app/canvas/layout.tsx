import type { Metadata } from 'next';
import { DM_Sans, DM_Mono } from 'next/font/google';

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
  title: 'FlowCraft Canvas',
  description: 'A visual AI agent orchestration tool',
};

export default function CanvasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${dmSans.variable} ${dmMono.variable} font-sans antialiased`}>
      {children}
    </div>
  );
}
