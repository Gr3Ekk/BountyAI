import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { useTenantAssignments, useTenantProjects, useTenantTeams } from '../hooks/useTenantData';
import { deleteAssignment, generateTeamAccessCode, listBounties, type BountyResponse } from '../lib/backendApi';

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

export function ManagerDashboard() {
  const navigate = useNavigate();
  const tenantId = 'default';
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showTeamNameModal, setShowTeamNameModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [missionToDelete, setMissionToDelete] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isDeletingMission, setIsDeletingMission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Bounty state
  const [bounties, setBounties] = useState<BountyResponse[]>([]);
  const [isLoadingBounties, setIsLoadingBounties] = useState(true);
  
  const { data: teams = [], isLoading: teamsLoading, refetch: refetchTeams } = useTenantTeams({ tenantId, refetchInterval: 5000 });
  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useTenantProjects({ tenantId, refetchInterval: 5000 });
  const { data: assignments = [], isLoading: assignmentsLoading, refetch: refetchAssignments } = useTenantAssignments({ tenantId, refetchInterval: 5000 });

  const isLoading = teamsLoading || projectsLoading || assignmentsLoading;

  // Load bounties
  useEffect(() => {
    const loadBounties = async () => {
      try {
        const response = await listBounties();
        setBounties(response.bounties || []);
      } catch (error) {
        console.error('Failed to load bounties:', error);
      } finally {
        setIsLoadingBounties(false);
      }
    };
    loadBounties();
    
    // Refetch every 10 seconds
    const interval = setInterval(loadBounties, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerateCode = async () => {
    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }

    // Prevent double submission
    if (isGeneratingCode) return;

    setError(null);
    setIsGeneratingCode(true);
    try {
      const response = await generateTeamAccessCode(tenantId, teamName.trim());
      
      if (response.success && response.joinCode) {
        setGeneratedCode(response.joinCode);
        setShowTeamNameModal(false);
        setShowCodeModal(true);
        setTeamName('');
        // Immediately refetch teams to show the new team
        await refetchTeams();
      } else {
        setError('Failed to generate access code');
      }
    } catch (err) {
      console.error('Error generating team code:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate access code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleDeleteMission = (missionId: string) => {
    console.log('Attempting to delete mission:', missionId);
    setError(null);
    setMissionToDelete(missionId);
  };

  const confirmDeleteMission = async () => {
    if (!missionToDelete) return;
    
    // Prevent double submission
    if (isDeletingMission) return;
    
    console.log('Confirming delete for mission:', missionToDelete);
    setIsDeletingMission(true);
    setError(null);
    
    try {
      const response = await deleteAssignment(missionToDelete);
      console.log('Delete response:', response);
      
      if (response.success) {
        console.log('Delete successful, refreshing data...');
        // Close modal immediately
        setMissionToDelete(null);
        setIsDeletingMission(false);
        
        // Force refetch both assignments and projects with a small delay
        // to ensure backend has committed the change
        setTimeout(async () => {
          console.log('Triggering refetch...');
          await Promise.all([
            refetchAssignments(),
            refetchProjects()
          ]);
          console.log('Refetch complete');
        }, 300);
        return;
      } else {
        setError('Failed to delete mission');
      }
    } catch (err) {
      console.error('Error deleting mission:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete mission');
    } finally {
      setIsDeletingMission(false);
    }
  };

  // Calculate summary metrics
  const totalTeams = teams.length;
  const activeMissions = assignments.filter((a) => ['in-progress', 'accepted'].includes(a.status)).length;
  const completedMissions = assignments.filter((a) => a.status === 'completed').length;
  
  // Bounty stats
  const bountyStats = useMemo(() => {
    const available = bounties.filter((b) => b.status === 'available' || b.status === 'open').length;
    const claimed = bounties.filter((b) => b.status === 'claimed').length;
    const completed = bounties.filter((b) => b.status === 'completed').length;
    const total = bounties.length;
    
    return { available, claimed, completed, total };
  }, [bounties]);

  // Active Missions with full project details
  const activeMissionsData = useMemo(() => {
    return assignments
      .filter((a) => ['in-progress', 'accepted', 'assigned'].includes(a.status))
      .map((assignment) => {
        const project = projects.find((p) => p.id === assignment.projectId);
        const team = teams.find((t) => t.id === assignment.teamId);
        return {
          id: assignment.id,
          projectTitle: project?.title ?? project?.name ?? 'Untitled',
          projectId: assignment.projectId,
          teamName: team?.name ?? 'Unknown Team',
          teamId: assignment.teamId,
          status: assignment.status,
          progress: assignment.progress ?? 0,
          deadline: project?.deadline,
          difficulty: project?.difficulty,
        };
      });
  }, [assignments, projects, teams]);

  // Teams with their current workload and productivity
  const teamsData = useMemo(() => {
    return teams.map((team) => {
      const teamAssignments = assignments.filter(
        (a) => a.teamId === team.id && ['in-progress', 'accepted'].includes(a.status)
      );
      const currentProject = teamAssignments[0];
      const project = currentProject ? projects.find((p) => p.id === currentProject.projectId) : undefined;
      
      return {
        id: team.id,
        name: team.name,
        skills: team.skills.slice(0, 3),
        productivity: team.productivityScore ?? team.productivity_rate ?? 0.75,
        currentAssignment: project?.title ?? project?.name ?? 'Available',
        activeProjects: teamAssignments.length,
        maxCapacity: team.maxCapacity ?? team.max_capacity ?? 5,
      };
    });
  }, [teams, assignments, projects]);

  // Pending bounties (not yet assigned)
  const pendingBounties = projects.filter((p) => p.status === 'open');
  const activeBounties = projects.filter((p) => p.status === 'assigned' || p.status === 'in-progress');

  return (
    <div className="space-y-6 pb-12">
      {/* Error Display */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => setShowTeamNameModal(true)}
          disabled={isGeneratingCode}
          className="rounded-xl border border-neon-teal/40 bg-neon-teal/10 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-neon-teal transition-all hover:bg-neon-teal/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Create New Team
        </button>
      </div>

      {/* Team Name Input Modal */}
      {showTeamNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !isGeneratingCode && setShowTeamNameModal(false)}>
          <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-foreground">Create New Team</h3>
            <p className="mt-2 text-sm text-foreground/60">Enter a name for the new team. An access code will be generated for team members to join.</p>
            
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
                Team Name
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., Alpha Team"
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isGeneratingCode) {
                      handleGenerateCode();
                    }
                  }}
                  autoFocus
                  disabled={isGeneratingCode}
                />
              </label>
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleGenerateCode}
                disabled={isGeneratingCode || !teamName.trim()}
                className="flex-1 rounded-xl border border-neon-teal/40 bg-neon-teal px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition-all hover:bg-neon-teal/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingCode ? 'Creating...' : 'Create Team'}
              </button>
              <button
                onClick={() => {
                  setShowTeamNameModal(false);
                  setTeamName('');
                  setError(null);
                }}
                disabled={isGeneratingCode}
                className="flex-1 rounded-xl border border-black/10 bg-transparent px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-foreground transition-all hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Generation Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCodeModal(false)}>
          <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-foreground">New Team Access Code</h3>
            <p className="mt-2 text-sm text-foreground/60">Share this code with new team members to create their accounts:</p>
            <div className="mt-6 rounded-xl border border-neon-teal/40 bg-neon-teal/10 p-6 text-center">
              <div className="text-3xl font-bold tracking-[0.3em] text-neon-teal">{generatedCode}</div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(generatedCode)}
                className="flex-1 rounded-xl border border-black/10 bg-foreground px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-background transition-all hover:bg-foreground/90"
              >
                Copy Code
              </button>
              <button
                onClick={() => setShowCodeModal(false)}
                className="flex-1 rounded-xl border border-black/10 bg-transparent px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-foreground transition-all hover:bg-black/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {missionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !isDeletingMission && setMissionToDelete(null)}>
          <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-foreground">Delete Mission</h3>
            <p className="mt-2 text-sm text-foreground/60">Are you sure you want to delete this mission? This action cannot be undone.</p>
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={confirmDeleteMission}
                disabled={isDeletingMission}
                className="flex-1 rounded-xl border border-red-500/40 bg-red-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition-all hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingMission ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setMissionToDelete(null)}
                disabled={isDeletingMission}
                className="flex-1 rounded-xl border border-black/10 bg-transparent px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-foreground transition-all hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Stats - Balanced Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-neon-teal/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Active Teams</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">
            {isLoading ? '—' : totalTeams}
          </div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-neon-purple/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Active Missions</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">
            {isLoading ? '—' : activeMissions}
          </div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-yellow-400/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Available Bounties</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">
            {isLoadingBounties ? '—' : bountyStats.available}
          </div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-blue-400/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Claimed Bounties</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">
            {isLoadingBounties ? '—' : bountyStats.claimed}
          </div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-foreground/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Completed</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">
            {isLoading ? '—' : completedMissions + bountyStats.completed}
          </div>
        </GlassCard>
      </div>

      {/* Main Content - Balanced Bento Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active Missions - Spans 2 columns on large screens */}
        <div className="lg:col-span-2">
          <GlassCard className="h-full">
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Active Missions</h3>
                <p className="text-sm text-foreground/60">Projects currently in flight</p>
              </div>
              <button
                onClick={() => navigate('/manager/ai-copilot')}
                className="rounded-xl border border-neon-teal/40 bg-neon-teal/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neon-teal transition-all hover:bg-neon-teal/20"
              >
                + New Mission
              </button>
            </header>

            <div className="mt-6 space-y-3 max-h-96 overflow-y-auto pr-2">
              {isLoading && (
                <div className="rounded-2xl border border-black/5 bg-white/70 p-5 text-sm text-foreground/60">
                  Loading missions...
                </div>
              )}
              {!isLoading && activeMissionsData.length === 0 && (
                <div className="rounded-2xl border border-black/5 bg-white/70 p-5 text-sm text-foreground/60">
                  No active missions. Launch a bounty to get started.
                </div>
              )}
              {activeMissionsData.slice(0, 5).map((mission) => (
                <div
                  key={mission.id}
                  className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm transition-all hover:border-neon-teal/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/manager/assignment/${mission.id}`)}
                    >
                      <h4 className="text-base font-semibold text-foreground">{mission.projectTitle}</h4>
                      <div className="mt-2 flex items-center gap-3 text-sm">
                        <span className="rounded-full border border-neon-purple/30 bg-neon-purple/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-neon-purple">
                          {mission.teamName}
                        </span>
                        {mission.difficulty && (
                          <span className="text-xs text-foreground/60">{mission.difficulty}</span>
                        )}
                        <span className="text-xs text-foreground/60">{formatDateLabel(mission.deadline)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMission(mission.id);
                      }}
                      className="ml-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-500 transition-all hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                  
                  {/* Progress Bar */}
                  <div 
                    className="mt-4 cursor-pointer"
                    onClick={() => navigate(`/manager/assignment/${mission.id}`)}
                  >
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-neon-teal transition-all"
                        style={{ width: `${Math.min(mission.progress, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-foreground/50">{mission.progress}% Complete</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Teams Overview - 1 column */}
        <div className="lg:col-span-1">
          <GlassCard className="h-full">
            <header>
              <h3 className="text-lg font-semibold text-foreground">Teams</h3>
              <p className="text-sm text-foreground/60">Squad performance</p>
            </header>

            <div className="mt-6 space-y-3 max-h-96 overflow-y-auto pr-2">
              {isLoading && (
                <div className="rounded-2xl border border-black/5 bg-white/70 p-4 text-sm text-foreground/60">
                  Loading teams...
                </div>
              )}
              {!isLoading && teamsData.length === 0 && (
                <div className="rounded-2xl border border-black/5 bg-white/70 p-4 text-sm text-foreground/60">
                  No teams yet.
                </div>
              )}
              {teamsData.map((team) => (
                <div key={team.id} className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-foreground">{team.name}</h4>
                      <div className="mt-1 text-xs text-foreground/50">
                        {team.skills.join(' • ')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-foreground/50">Productivity</span>
                      <span className="font-semibold text-neon-teal">{formatPercent(team.productivity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/50">Active Projects</span>
                      <span className="font-semibold text-foreground">
                        {team.activeProjects} / {team.maxCapacity}
                      </span>
                    </div>
                    <div className="mt-2 text-foreground/60">
                      <span className="font-medium">Current:</span> {team.currentAssignment}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Bounties Section - Balanced Bento Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending Bounties */}
        <GlassCard className="flex flex-col">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Pending Bounties</h3>
              <p className="text-sm text-foreground/60">Awaiting assignment</p>
            </div>
            <span className="rounded-full border border-neon-orange/40 bg-neon-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-neon-orange">
              {pendingBounties.length} Open
            </span>
          </header>

          <div className="mt-6 flex-1 space-y-3 max-h-64 overflow-y-auto">
            {pendingBounties.length === 0 && (
              <div className="rounded-2xl border border-black/5 bg-white/70 p-4 text-sm text-foreground/60">
                No pending bounties
              </div>
            )}
            {pendingBounties.map((bounty) => (
              <div
                key={bounty.id}
                className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm cursor-pointer hover:border-neon-orange/30 transition-all"
                onClick={() => navigate('/manager/ai-copilot')}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-foreground">{bounty.title}</h4>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full border border-black/10 bg-white/90 px-3 py-1 text-[10px] uppercase tracking-wider text-foreground/60">
                        {bounty.difficulty}
                      </span>
                      {bounty.reward && (
                        <span className="text-xs text-foreground/60">{(bounty.reward / 1000).toFixed(1)}K pts</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Active Bounties */}
        <GlassCard className="flex flex-col">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Active Bounties</h3>
              <p className="text-sm text-foreground/60">Currently assigned</p>
            </div>
            <span className="rounded-full border border-neon-teal/40 bg-neon-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-neon-teal">
              {activeBounties.length} Active
            </span>
          </header>

          <div className="mt-6 flex-1 space-y-3 max-h-64 overflow-y-auto">
            {activeBounties.length === 0 && (
              <div className="rounded-2xl border border-black/5 bg-white/70 p-4 text-sm text-foreground/60">
                No active bounties
              </div>
            )}
            {activeBounties.map((bounty) => {
              const assignment = assignments.find((a) => a.projectId === bounty.id);
              const team = teams.find((t) => t.id === assignment?.teamId);
              return (
                <div
                  key={bounty.id}
                  className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-foreground">{bounty.title}</h4>
                      {team && (
                        <div className="mt-2">
                          <span className="rounded-full border border-neon-purple/30 bg-neon-purple/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-neon-purple">
                            {team.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="rounded-full border border-black/10 bg-white/90 px-2 py-1 text-[10px] uppercase tracking-wider text-foreground/60">
                      {bounty.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
