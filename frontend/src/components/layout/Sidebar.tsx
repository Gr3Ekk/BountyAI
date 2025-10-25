import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

const navByRole = {
  manager: [
    {
      label: 'Mission Control',
      to: '/manager',
      subtitle: 'Manager dashboard',
    },
  ],
  developer: [
    {
      label: 'Crew Hub',
      to: '/developer',
      subtitle: 'Developer workspace',
    },
  ],
} as const;

export function Sidebar() {
  const {
    state: { role, name, organization, teamName },
    logout,
  } = useAuth();

  const navItems = role ? navByRole[role] : [];

  return (
    <aside className="relative flex h-full w-72 flex-col justify-between border-r border-black/10 bg-panel/80 p-6 shadow-panel backdrop-blur-lg">
      <div className="space-y-10">
        <div>
          <div className="text-xs uppercase tracking-[0.6em] text-foreground/60">BOUNTYAI</div>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">
            Operations Desk
          </h1>
          {role && (
            <div className="mt-3 space-y-1 text-sm text-foreground/60">
              <div className="font-semibold text-foreground">{name}</div>
              <div className="uppercase tracking-[0.3em] text-xs text-foreground/50">
                {role === 'manager' ? 'Manager' : 'Developer'}
              </div>
              {role === 'manager' && organization && (
                <div className="text-xs text-foreground/50">{organization}</div>
              )}
              {role === 'developer' && teamName && (
                <div className="text-xs text-foreground/50">{teamName}</div>
              )}
            </div>
          )}
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'block rounded-xl border border-transparent px-4 py-4 transition-all',
                  'hover:border-neon-teal/30 hover:shadow-glow',
                  isActive
                    ? 'border-neon-teal/60 bg-white/80 text-foreground shadow-glow'
                    : 'text-foreground/70'
                )
              }
            >
              <div className="text-sm font-semibold tracking-wide">
                {item.label}
              </div>
              <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">
                {item.subtitle}
              </div>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="space-y-3">
        <button
          onClick={logout}
          className="w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-foreground transition-colors hover:border-foreground/40"
        >
          Log Out
        </button>
        <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-xs uppercase tracking-[0.3em] text-foreground/50 shadow-panel">
          <div>PRODUCTIVITY ENGINE</div>
          <div className="mt-2 text-sm font-semibold tracking-wide text-foreground">
            Control Suite v0.1.0
          </div>
        </div>
      </div>
    </aside>
  );
}
