import { useMemo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { useTenantAssignments, useTenantDevelopers, useTenantProjects, useTenantTeams } from '../hooks/useTenantData';
import { useAuth } from '../context/AuthContext';

type SquadAssignment = {
  id: string;
  title: string;
  status: string;
  progress: number;
  squad: string;
};

type BountyBoardItem = {
  id: string;
  title: string;
  reward: string;
  difficulty: string;
  skills: string[];
};

function parseReward(value?: number): string {
  if (typeof value !== 'number') return '—';
  return `$${(value / 1000).toFixed(1)}K`;
}

export function DeveloperHub() {
  const { state } = useAuth();
  const tenantId = 'default';

  const { data: teams = [] } = useTenantTeams({ tenantId });
  const { data: projects = [] } = useTenantProjects({ tenantId });
  const { data: assignments = [] } = useTenantAssignments({ tenantId });
  const { data: developers = [] } = useTenantDevelopers({ tenantId });

  const developerProfile = useMemo(() => {
    const normalizedEmail = state.email?.toLowerCase();
    if (!normalizedEmail) return undefined;
    return developers.find((dev) => dev.email.toLowerCase() === normalizedEmail);
  }, [developers, state.email]);

  const developerTeam = useMemo(() => {
    if (developerProfile?.primaryTeamId) {
      return teams.find((team) => team.id === developerProfile.primaryTeamId);
    }
    if (state.teamName) {
      return teams.find((team) => team.name.toLowerCase() === state.teamName?.toLowerCase());
    }
    return undefined;
  }, [developerProfile?.primaryTeamId, state.teamName, teams]);

  const squadAssignments = useMemo<SquadAssignment[]>(() => {
    if (!developerTeam) return [];
    return assignments
      .filter((assignment) => assignment.teamId === developerTeam.id)
      .map((assignment) => {
        const project = projects.find((item) => item.id === assignment.projectId);
        return {
          id: assignment.id,
          title: project?.title ?? project?.name ?? 'Untitled mission',
          status: assignment.status,
          progress: assignment.progress ?? 0,
          squad: developerTeam.name,
        };
      });
  }, [assignments, developerTeam, projects]);

  const bountyBoardItems = useMemo<BountyBoardItem[]>(() =>
    projects
      .filter((project) => project.status === 'open')
      .map((project) => ({
        id: project.id,
        title: project.title,
        reward: parseReward(project.reward),
        difficulty: project.difficulty,
        skills: project.skillsRequired,
      })),
  [projects]);

  const teamTagline = developerTeam?.description ?? 'Aligned with orbital objectives.';
  const activeAssignmentCount = squadAssignments.length;

  return (
    <div className="space-y-8 pb-12">
      <GlassCard>
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Squad Assignments
            </h3>
            <p className="text-sm text-foreground/60">
              {developerTeam
                ? `${developerTeam.name} • ${teamTagline}`
                : 'Link your profile to a squad to start receiving missions.'}
            </p>
          </div>
          <span className="rounded-full border border-neon-purple/40 bg-neon-purple/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-neon-purple">
            {activeAssignmentCount > 0 ? 'Live Sync' : 'Awaiting Orders'}
          </span>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {squadAssignments.length === 0 && (
            <div className="rounded-2xl border border-black/5 bg-white/70 p-5 text-sm text-foreground/60">
              No active missions yet. Check the bounty board to pick up an assignment or ping your manager.
            </div>
          )}
          {squadAssignments.map((assignment) => (
            <div
              key={assignment.id}
              className="rounded-2xl border border-black/5 bg-white/70 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-foreground">
                  {assignment.title}
                </h4>
                <span className="text-xs uppercase tracking-[0.3em] text-foreground/50">
                  {assignment.status}
                </span>
              </div>
              <div className="mt-3 text-sm text-foreground/60">
                Crew: {assignment.squad}
              </div>
              <div className="mt-4 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-neon-teal transition-all"
                  style={{ width: `${Math.min(assignment.progress, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.3em] text-foreground/50">
                {assignment.progress}% Complete
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Bounty Board
            </h3>
            <p className="text-sm text-foreground/60">
              Claim side missions to boost squad rankings and earn rewards.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-foreground/50">
            <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1">
              Open • {bountyBoardItems.length}
            </span>
            <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1">
              Reward Index
            </span>
          </div>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {bountyBoardItems.length === 0 && (
            <div className="rounded-2xl border border-black/5 bg-white/70 p-5 text-sm text-foreground/60">
              The board is clear. Check back after mission control launches new bounties.
            </div>
          )}
          {bountyBoardItems.map((bounty) => (
            <div
              key={bounty.id}
              className="flex h-full flex-col justify-between rounded-2xl border border-black/5 bg-white/70 p-5 shadow-sm"
            >
              <div>
                <h4 className="text-base font-semibold text-foreground">
                  {bounty.title}
                </h4>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.25em] text-foreground/50">
                  <span className="rounded-full border border-neon-teal/40 bg-neon-teal/10 px-3 py-1 text-neon-teal">
                    {bounty.difficulty}
                  </span>
                  <span className="rounded-full border border-neon-orange/40 bg-neon-orange/10 px-3 py-1 text-neon-orange">
                    {bounty.reward}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-foreground/60">
                  {bounty.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-black/10 bg-white/90 px-3 py-1"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="mt-6 w-full rounded-2xl border border-foreground/10 bg-foreground px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-background opacity-60 transition-all"
                disabled
              >
                Claim Flow Coming Soon
              </button>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
