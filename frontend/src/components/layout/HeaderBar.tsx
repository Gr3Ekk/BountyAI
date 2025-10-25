import { useLocation } from 'react-router-dom';

const viewTitles: Record<string, { title: string; subtitle: string }> = {
  '/manager': {
    title: 'Mission Control Overview',
    subtitle: 'Track team output, workloads, and launch new bounties.',
  },
  '/developer': {
    title: 'Crew Assignment Log',
    subtitle: 'Review squad objectives and claim open bounties.',
  },
};

function getViewMeta(pathname: string) {
  return (
    viewTitles[pathname as keyof typeof viewTitles] ?? {
      title: 'BountyAI Operations',
      subtitle: 'Automation intelligence for the frontier.',
    }
  );
}

export function HeaderBar() {
  const { pathname } = useLocation();
  const meta = getViewMeta(pathname);

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-2 border-b border-black/5 bg-white/70 px-10 py-6 backdrop-blur-lg">
      <div className="text-xs uppercase tracking-[0.35em] text-foreground/50">
        Operational Briefing
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-semibold text-foreground">{meta.title}</h2>
        <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-foreground/60">
          {new Date().toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>
      <p className="max-w-2xl text-sm text-foreground/70">{meta.subtitle}</p>
    </header>
  );
}
