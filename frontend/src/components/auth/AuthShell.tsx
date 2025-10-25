import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-foreground text-background lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground/90 to-foreground" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="space-y-4">
            <Link to="/" className="text-xs uppercase tracking-[0.4em] text-background/60">
              BOUNTYAI PLATFORM
            </Link>
            <h1 className="text-4xl font-semibold uppercase tracking-[0.3em]">
              Mission Access Console
            </h1>
            <p className="max-w-md text-sm text-background/70">
              Connect squads and managers in one unified control desk. Track production, launch bounties, and keep velocity steady.
            </p>
          </div>
          <div className="space-y-3 text-sm text-background/50">
            <p>Need a manager access code? Contact your ops lead.</p>
            <p>Questions about deployment? Email pensonluis57@gmail.com.</p>
          </div>
        </div>
      </div>

      <div className="relative flex flex-col bg-background/95 p-6 sm:p-10">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.4em] text-foreground/50">
              BOUNTYAI ACCESS
            </div>
            <h2 className="text-3xl font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-foreground/60">{subtitle}</p>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-panel backdrop-blur-lg">
            {children}
          </div>

          {footer && <div className="text-sm text-foreground/60">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
