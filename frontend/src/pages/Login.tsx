import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

const DEMO_PROFILES: Record<
  UserRole,
  {
    email: string;
    password: string;
    name: string;
    organization?: string;
    teamName?: string;
  }
> = {
  manager: {
    email: 'manager@bountyai.dev',
    password: 'manager123',
    name: 'Avery Holt',
    organization: 'Orion Command',
  },
  developer: {
    email: 'developer@bountyai.dev',
    password: 'dev12345',
    name: 'Lena Park',
    teamName: 'Echo Knights',
  },
};

export function LoginPage() {
  const [role, setRole] = useState<UserRole>('manager');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from;

  const {
    login,
    state: { status, role: sessionRole, error: authError },
  } = useAuth();

  const isLoading = isSubmitting || status === 'loading';

  useEffect(() => {
    if (status === 'authenticated') {
      const destination = from?.pathname ?? (sessionRole === 'manager' ? '/manager' : '/developer');
      navigate(destination, { replace: true });
    }
  }, [status, sessionRole, from?.pathname, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email.trim().toLowerCase(), password.trim());
    } catch (authErr) {
      setError(authErr instanceof Error ? authErr.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin(selectedRole: UserRole) {
    const preset = DEMO_PROFILES[selectedRole];
    setRole(selectedRole);
    setError(null);
    try {
      setIsSubmitting(true);
      await login(preset.email, preset.password);
    } catch (authErr) {
      setError(authErr instanceof Error ? authErr.message : 'Unable to sign in with demo credentials.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function preloadDemo(selectedRole: UserRole) {
    const preset = DEMO_PROFILES[selectedRole];
    setRole(selectedRole);
    setEmail(preset.email);
    setPassword(preset.password);
  }

  return (
    <AuthShell
      title="Access your control desk"
      subtitle="Sign in as a manager to orchestrate teams or as a developer to view assignments."
      footer={
        <p>
          Need an account?{' '}
          <Link to="/auth/register" className="font-semibold text-foreground">
            Create one now.
          </Link>
        </p>
      }
    >
      <div className="space-y-6">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="flex gap-3">
            {(
              [
                { key: 'manager', label: 'Manager' },
                { key: 'developer', label: 'Developer' },
              ] as Array<{ key: UserRole; label: string }>
            ).map((option) => {
              const isActive = role === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRole(option.key)}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition-all ${
                    isActive
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-black/10 bg-white/80 text-foreground/70 hover:border-foreground/30'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
              Email
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
                required
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
              Password
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
                required
              />
            </label>
          </div>

          {(error || authError) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error ?? authError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl border border-foreground/10 bg-foreground px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-background transition-transform hover:-translate-y-0.5"
          >
            {isLoading ? 'Signing in…' : 'Continue'}
          </button>
        </form>

        <p className="text-xs text-foreground/50">
          Access codes are only required when creating a new developer account. You can sign in directly with your email and password.
        </p>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-foreground/70">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">
            Demo credentials
          </div>
          <p className="mt-2 text-xs text-foreground/60">
            Use the quick actions below to log in instantly with sample accounts, or fill the form using the provided credentials.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                { role: 'manager' as const, tone: 'text-neon-teal', border: 'border-neon-teal/40' },
                { role: 'developer' as const, tone: 'text-neon-purple', border: 'border-neon-purple/40' },
              ]
            ).map(({ role: demoRole, tone, border }) => {
              const preset = DEMO_PROFILES[demoRole];
              return (
                <div
                  key={demoRole}
                  className={`rounded-xl border ${border} bg-white/80 p-4 shadow-sm transition-transform hover:-translate-y-0.5`}
                >
                  <div className={`text-xs font-semibold uppercase tracking-[0.3em] ${tone}`}>
                    {demoRole === 'manager' ? 'Manager demo' : 'Developer demo'}
                  </div>
                  <div className="mt-3 text-xs text-foreground/60">
                    <div>Email: {preset.email}</div>
                    <div>Password: {preset.password}</div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => preloadDemo(demoRole)}
                      className="flex-1 rounded-xl border border-black/10 bg-transparent px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground transition-colors hover:border-foreground/30"
                    >
                      Fill form
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDemoLogin(demoRole)}
                      className="flex-1 rounded-xl border border-foreground/10 bg-foreground px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-background disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isLoading}
                    >
                      {isLoading && role === demoRole ? 'Signing…' : 'Quick login'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
