import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';
import logoImage from '../../assets/sidelogo.jpeg';

interface NavItem {
  to: string;
  label: string;
  icon?: string;
  subtitle?: string;
  special?: boolean;
}

const navByRole: Record<UserRole, NavItem[]> = {
  manager: [
    { 
      to: '/manager/steve', 
      label: 'S.T.E.V.E', 
      subtitle: 'AI Copilot',
      special: true 
    },
    { to: '/manager', label: 'Dashboard' },
    { to: '/manager/side-bounties', label: 'Side Bounties' },
  ],
  developer: [
    { to: '/developer', label: 'Dashboard' },
    { to: '/developer/side-bounties', label: 'Side Bounties' },
  ],
};

export function Sidebar() {
  const {
    state: { role, name, organization, teamName },
    logout,
  } = useAuth();

  const navItems = role ? navByRole[role] : [];

  return (
    <aside className="fixed left-0 top-0 bottom-0 flex h-screen w-72 flex-col justify-between border-r border-white/10 bg-black p-6 overflow-hidden">
      <div className="space-y-10 flex-shrink-0">
        <div className="flex items-center justify-center">
          <img 
            src={logoImage} 
            alt="BountyAI Logo" 
            className="w-32 h-auto rounded-lg"
          />
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'block rounded-xl border px-4 py-4 transition-all',
                    item.special
                      ? 'border-purple-500/50 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20'
                      : 'border-white/10 hover:border-white/30 hover:bg-white/5',
                    isActive && !item.special
                      ? 'border-white/30 bg-white/10 text-white'
                      : item.special && isActive
                      ? 'border-purple-500/70 bg-gradient-to-r from-purple-500/20 to-blue-500/20'
                      : 'text-white/70'
                  )
                }
              >
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  <div className="flex-1">
                    <div className="text-sm font-semibold tracking-wide text-white">
                      {item.label}
                    </div>
                    {item.subtitle && (
                      <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 flex-shrink-0">
        {role && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.3em] text-white/50">
              {role === 'manager' ? 'Manager' : 'Developer'}
            </div>
            <div className="mt-2 font-semibold text-white">{name}</div>
            {role === 'manager' && organization && (
              <div className="mt-1 text-xs text-white/50">{organization}</div>
            )}
            {role === 'developer' && teamName && (
              <div className="mt-1 text-xs text-white/50">{teamName}</div>
            )}
          </div>
        )}
        
        <button
          onClick={logout}
          className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition-colors hover:border-white/40 hover:bg-white/5"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
