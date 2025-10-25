import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={`rounded-3xl border border-white/60 bg-white/70 p-6 shadow-panel backdrop-blur-xl ${
        className ?? ''
      }`}
    >
      {children}
    </div>
  );
}
