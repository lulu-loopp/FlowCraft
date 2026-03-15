import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FlowCraft — Canvas',
  description: 'Visual AI agent orchestration canvas.',
};

export default function CanvasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
