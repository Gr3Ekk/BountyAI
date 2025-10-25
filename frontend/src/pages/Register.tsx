import { useState } from 'react';
import type { FormEvent } from 'react';
import type { UserRole } from '../types/auth';
import { AuthShell } from '../components/auth/AuthShell';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const SAMPLE_MANAGER_CODES = ['ALPHA-417A', 'BETA-902C', 'DELTA-305F'];

function isValidCode(code: string) {
  if (!code) return false;
  const normalized = code.trim().toUpperCase();
  return /^[A-Z]+-[0-9]{3}[A-Z]$/.test(normalized) || SAMPLE_MANAGER_CODES.includes(normalized);
}

export function RegisterPage() {
  const [role, setRole] = useState<UserRole>('manager');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    state: { status, error: authError },
  } = useAuth();
  const navigate = useNavigate();

  const isLoading = isSubmitting || status === 'loading';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email, and password are required.');
      return;
    }

    if (role === 'manager' && !organization.trim()) {
      setError('Please provide your organization or team label.');
      return;
    }

    if (role === 'developer') {
      if (!teamName.trim()) {
        setError('Team name is required for developer onboarding.');
        return;
      }
      if (!isValidCode(accessCode)) {
        setError('Enter a valid manager access code.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await register({
        role,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        organization: role === 'manager' ? organization.trim() : undefined,
        teamName: role === 'developer' ? teamName.trim() : undefined,
        accessCode: role === 'developer' ? accessCode.trim().toUpperCase() : undefined,
      });

      navigate(role === 'manager' ? '/manager' : '/developer', { replace: true });
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : 'We could not finish creating your account. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your BountyAI account"
      subtitle="Managers spin up control rooms. Developers join squads using a manager-issued code."
      footer={
        <p>
          Already have credentials?{' '}
          <Link to="/auth/login" className="font-semibold text-foreground">
            Sign in here.
          </Link>
        </p>
      }
    >
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
            Full Name
            <input
              type="text"
              placeholder="Taylor Jenkins"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              required
            />
          </label>

          <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
            Email
            <input
              type="email"
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
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              required
            />
          </label>

          {role === 'manager' && (
            <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
              Organization / Team Label
              <input
                type="text"
                placeholder="Orbit Ops"
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-purple focus:outline-none focus:ring-2 focus:ring-neon-purple/30"
              />
            </label>
          )}

          {role === 'developer' && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
                Squad / Team Name
                <input
                  type="text"
                  placeholder="Alpha Pilots"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
                Manager Access Code
                <input
                  type="text"
                  placeholder="ALPHA-417A"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground uppercase focus:border-neon-purple focus:outline-none focus:ring-2 focus:ring-neon-purple/30"
                />
              </label>

              <p className="text-xs text-foreground/50">
                Ask your manager for the access code that links you to their control
                room. Codes follow the pattern TEAM-123X and are only required
                during account creation.
              </p>
            </div>
          )}
        </div>

        {(error || authError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error ?? authError}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-2xl border border-foreground/10 bg-foreground px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
    </AuthShell>
  );
}
