import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassCard } from '../components/ui/GlassCard';
import { useTenantAssignments, useTenantProjects, useTenantTeams } from '../hooks/useTenantData';
import { assignBounty, createTeam } from '../lib/backendApi';
import type { Assignment, Project, Team } from '../types/models';
import { useAuth } from '../context/AuthContext';

type SummaryMetric = {
  label: string;
  value: string;
  accent: string;
};

type ActiveLaunch = {
  id: string;
  title: string;
  team: string;
  status: string;
  deadlineLabel: string;
  progressLabel: string;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDateLabel(value?: string) {
  if (!value) return 'No deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function buildSummaryMetrics(teams: Team[], projects: Project[]): SummaryMetric[] {
  const totalTeams = teams.length;
  const openBounties = projects.filter((project) => project.status === 'open').length;
  const productivitySum = teams.reduce((acc, team) => {
    const value = team.productivityScore ?? team.productivity_rate ?? 0;
    return acc + value;
  }, 0);
  const avgProductivity = totalTeams > 0 ? productivitySum / totalTeams : 0;

  const { capacityUsed, capacityTotal } = teams.reduce(
    (acc, team) => {
      const workload = team.currentWorkload ?? team.current_workload ?? 0;
      const capacity = team.maxCapacity ?? team.max_capacity ?? 0;
      return {
        capacityUsed: acc.capacityUsed + workload,
        capacityTotal: acc.capacityTotal + capacity,
      };
    },
    { capacityUsed: 0, capacityTotal: 0 },
  );

  const utilization = capacityTotal > 0 ? capacityUsed / capacityTotal : 0;

  return [
    { label: 'Active Teams', value: totalTeams.toString(), accent: 'bg-neon-teal/80' },
    { label: 'Open Bounties', value: openBounties.toString(), accent: 'bg-neon-purple/80' },
    { label: 'Avg Productivity', value: formatPercent(avgProductivity), accent: 'bg-neon-orange/80' },
    { label: 'Utilization', value: formatPercent(utilization), accent: 'bg-foreground/80' },
  ];
}

function buildActiveLaunches(assignments: Assignment[], projects: Project[], teams: Team[]): ActiveLaunch[] {
  return assignments
    .map((assignment) => {
      const project = projects.find((item) => item.id === assignment.projectId);
      const team = teams.find((item) => item.id === assignment.teamId);
      const progressLabel = assignment.progress != null ? `${assignment.progress}% Complete` : 'In Flight';
      return {
        id: assignment.id,
        title: project?.title ?? project?.name ?? 'Untitled mission',
        team: team?.name ?? 'Unassigned crew',
        status: assignment.status,
        deadlineLabel: formatDateLabel(project?.deadline ?? assignment.dueDate),
        progressLabel,
      };
    })
    .sort((a, b) => a.deadlineLabel.localeCompare(b.deadlineLabel))
    .slice(0, 5);
}

export function ManagerDashboard() {
  const { state } = useAuth();
  const tenantId = 'default';
  const queryClient = useQueryClient();
  const { data: teams = [], isLoading: teamsLoading } = useTenantTeams({ tenantId });
  const { data: projects = [], isLoading: projectsLoading } = useTenantProjects({ tenantId });
  const { data: assignments = [], isLoading: assignmentsLoading } = useTenantAssignments({ tenantId });

  const summaryMetrics = useMemo(
    () => buildSummaryMetrics(teams, projects),
    [teams, projects],
  );

  const activeLaunches = useMemo(
    () => buildActiveLaunches(assignments, projects, teams),
    [assignments, projects, teams],
  );

  const openProjects = useMemo(
    () => projects.filter((project) => project.status === 'open'),
    [projects],
  );

  const [selectedBounty, setSelectedBounty] = useState<string | null>(openProjects[0]?.id ?? null);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamSkills, setTeamSkills] = useState('');
  const [teamCapacity, setTeamCapacity] = useState(5);
  const [latestJoinCode, setLatestJoinCode] = useState<string | null>(null);
  const [teamFormError, setTeamFormError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);

  const assignMutation = useMutation({
    mutationFn: async (bountyId: string) => assignBounty(bountyId),
    onSuccess: (response) => {
      if (response.success) {
        setAssignmentMessage('Mission assigned successfully via AI matching.');
  void queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'assignments'], exact: false });
  void queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'projects'], exact: false });
      } else if (response.error) {
        setAssignmentMessage(response.error);
      } else {
        setAssignmentMessage('Assignment completed.');
      }
    },
    onError: (error: unknown) => {
      setAssignmentMessage(error instanceof Error ? error.message : 'Failed to assign bounty.');
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: (response) => {
      if (response.success && response.joinCode) {
        setLatestJoinCode(response.joinCode);
        setTeamName('');
        setTeamDescription('');
        setTeamSkills('');
        setTeamCapacity(5);
        setTeamFormError(null);
  void queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'teams'], exact: false });
      } else {
        setTeamFormError(response.error ?? 'Unable to create team.');
      }
    },
    onError: (error: unknown) => {
      setTeamFormError(error instanceof Error ? error.message : 'Unable to create team.');
    },
  });

  const isLoading = teamsLoading || projectsLoading || assignmentsLoading;

  function handleAssignBounty() {
    if (!selectedBounty) {
      setAssignmentMessage('Select an open bounty to auto assign.');
      return;
    }
    setAssignmentMessage('Dispatching mission assignment…');
    assignMutation.mutate(selectedBounty);
  }

  function handleCreateTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTeamFormError(null);
    const trimmedName = teamName.trim();
    if (!trimmedName) {
      setTeamFormError('A squad name is required.');
      return;
    }
    const skills = teamSkills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);

    createTeamMutation.mutate({
  tenantId,
      name: trimmedName,
      description: teamDescription.trim() || undefined,
      skills,
  leadUid: state.email ?? 'manager@bountyai.dev',
      maxCapacity: teamCapacity,
    });
  }

  return (
    <div className="space-y-8 pb-12">
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {summaryMetrics.map((metric) => (
          <GlassCard key={metric.label} className="relative overflow-hidden">
            <div className={`absolute inset-y-0 right-0 w-10 blur-3xl ${metric.accent}`} />
            <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">
              {metric.label}
            </div>
            <div className="mt-4 text-3xl font-semibold text-foreground">
              {isLoading ? '—' : metric.value}
            </div>
          </GlassCard>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard>
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Bounty Launch Console
              </h3>
              <p className="text-sm text-foreground/60">
                Select an open bounty and let the AI route it to the optimal squad.
              </p>
            </div>
            <span className="rounded-full border border-neon-teal/40 bg-neon-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-neon-teal">
              Auto Assign
            </span>
          </header>

          <div className="mt-8 space-y-6">
            <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
              Open Bounties
              <select
                value={selectedBounty ?? ''}
                onChange={(event) => setSelectedBounty(event.target.value || null)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              >
                {openProjects.length === 0 && <option value="">No open bounties</option>}
                {openProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title} • {project.difficulty}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-3 text-sm text-foreground/60">
              <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.3em] text-foreground/60">
                  Status
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-neon-teal">
                  {assignMutation.isPending ? 'Dispatching' : 'Ready'}
                </span>
              </div>
              {assignmentMessage && (
                <div className="rounded-xl border border-neon-teal/30 bg-neon-teal/5 px-4 py-3 text-xs uppercase tracking-[0.25em] text-neon-teal">
                  {assignmentMessage}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleAssignBounty}
              disabled={assignMutation.isPending || openProjects.length === 0}
              className="w-full rounded-2xl border border-neon-teal/40 bg-neon-teal/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-background shadow-glow transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-white/60 disabled:text-foreground/40"
            >
              {assignMutation.isPending ? 'Assigning…' : 'Auto Assign via AI'}
            </button>
          </div>
        </GlassCard>

        <GlassCard>
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Active Launches
              </h3>
              <p className="text-sm text-foreground/60">
                Monitoring priority missions and assigned flight crews.
              </p>
            </div>
            <span className="rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-foreground/70">
              Live Feed
            </span>
          </header>

          <div className="mt-6 space-y-4">
            {activeLaunches.length === 0 && (
              <div className="rounded-2xl border border-black/5 bg-white/70 p-4 text-sm text-foreground/60">
                No missions in flight. Assign a bounty to kick things off.
              </div>
            )}
            {activeLaunches.map((launch) => (
              <div
                key={launch.id}
                className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold text-foreground">
                    {launch.title}
                  </h4>
                  <span className="text-xs uppercase tracking-[0.3em] text-foreground/50">
                    {launch.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-foreground/60">
                  <span className="rounded-full border border-neon-purple/30 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-neon-purple">
                    {launch.team}
                  </span>
                  <span>{launch.deadlineLabel}</span>
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.3em] text-foreground/50">
                  {launch.progressLabel}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      <GlassCard>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Squad Access Codes</h3>
            <p className="text-sm text-foreground/60">
              Share these join codes with new developers. Creating a squad issues a fresh code instantly.
            </p>
          </div>
          {latestJoinCode && (
            <span className="rounded-full border border-neon-orange/40 bg-neon-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-neon-orange">
              New Code: {latestJoinCode}
            </span>
          )}
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{team.name}</div>
                    <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">
                      {team.skills.slice(0, 4).join(' • ')}
                    </div>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.3em] text-neon-teal">
                    {team.joinCode ?? '•••••'}
                  </div>
                </div>
              </div>
            ))}
            {teams.length === 0 && (
              <div className="rounded-2xl border border-black/5 bg-white/70 p-4 text-sm text-foreground/60">
                No squads yet. Create one to generate your first access code.
              </div>
            )}
          </div>

          <form className="space-y-4" onSubmit={handleCreateTeam}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
                Create New Squad
              </div>
              <p className="mt-2 text-xs text-foreground/60">
                Define the core skills and capacity. A join code will be generated instantly.
              </p>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
              Squad Name
              <input
                type="text"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Lunar Ops Crew"
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
              Elevator Pitch
              <textarea
                rows={3}
                value={teamDescription}
                onChange={(event) => setTeamDescription(event.target.value)}
                placeholder="Mission critical specialists for warp-drive UI."
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
              Core Skills
              <input
                type="text"
                value={teamSkills}
                onChange={(event) => setTeamSkills(event.target.value)}
                placeholder="frontend, react, ui/ux"
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
              Max Concurrent Bounties
              <input
                type="number"
                min={1}
                max={12}
                value={teamCapacity}
                onChange={(event) => setTeamCapacity(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              />
            </label>

            {teamFormError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs uppercase tracking-[0.25em] text-red-600">
                {teamFormError}
              </div>
            )}

            <button
              type="submit"
              disabled={createTeamMutation.isPending}
              className="w-full rounded-2xl border border-foreground/10 bg-foreground px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-white/60 disabled:text-foreground/40"
            >
              {createTeamMutation.isPending ? 'Generating code…' : 'Create Squad & Generate Code'}
            </button>
          </form>
        </div>
      </GlassCard>
    </div>
  );
}
