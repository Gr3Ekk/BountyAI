import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { useTenantAssignments, useTenantDevelopers, useTenantProjects, useTenantTeams } from '../hooks/useTenantData';
import { useAuth } from '../context/AuthContext';
import { listBounties, claimBounty, completeBounty, type BountyResponse } from '../lib/backendApi';
import { cn } from '../lib/utils';

export function DeveloperHub() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const tenantId = 'default';

  const { data: teams = [] } = useTenantTeams({ tenantId });
  const { data: projects = [] } = useTenantProjects({ tenantId });
  const { data: assignments = [] } = useTenantAssignments({ tenantId });
  const { data: developers = [] } = useTenantDevelopers({ tenantId });

  // Bounty state
  const [bounties, setBounties] = useState<BountyResponse[]>([]);
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<string | null>(null);
  const [isLoadingBounties, setIsLoadingBounties] = useState(true);

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
  }, []);

  // Bounty stats
  const bountyStats = useMemo(() => {
    const developerId = developerProfile?.id || state.uid || '';
    const myActiveBounties = bounties.filter((b) => b.status === 'claimed' && b.claimedBy === developerId);
    const myCompletedBounties = bounties.filter((b) => b.status === 'completed' && b.claimedBy === developerId);
    const availableBounties = bounties.filter((b) => b.status === 'available' || b.status === 'open');
    
    const totalPointsEarned = myCompletedBounties.reduce((sum, b) => sum + (b.reward || 0), 0);
    
    return {
      myActive: myActiveBounties,
      myCompleted: myCompletedBounties,
      available: availableBounties,
      totalPointsEarned,
    };
  }, [bounties, developerProfile?.id, state.uid]);

  // Get individual task assignments for this developer
  const individualTasks = useMemo(() => {
    if (!developerProfile?.id) return [];
    
    const tasks: Array<{
      id: string;
      title: string;
      description: string;
      estimatedHours: number;
      projectTitle: string;
      assignmentId: string;
      status: string;
    }> = [];
    
    assignments.forEach((assignment) => {
      const project = projects.find((p) => p.id === assignment.projectId);
      const assignmentTasks = (assignment as any).tasks || [];
      
      // Filter tasks assigned to this developer
      assignmentTasks.forEach((task: any) => {
        if (task.assignedTo === developerProfile.id || task.assignedToId === developerProfile.id) {
          tasks.push({
            id: task.id,
            title: task.title,
            description: task.description || '',
            estimatedHours: task.estimatedHours || 0,
            projectTitle: project?.title || project?.name || 'Unknown Project',
            assignmentId: assignment.id,
            status: task.status || 'pending',
          });
        }
      });
    });
    
    return tasks;
  }, [assignments, developerProfile?.id, projects]);

  // Get team's overall project progress
  const teamProject = useMemo(() => {
    if (!developerTeam) return null;
    
    const teamAssignment = assignments.find((a) => a.teamId === developerTeam.id && ['in-progress', 'accepted', 'assigned'].includes(a.status));
    if (!teamAssignment) return null;
    
    const project = projects.find((p) => p.id === teamAssignment.projectId);
    if (!project) return null;
    
    return {
      id: project.id,
      title: project.title || project.name || 'Unknown Project',
      progress: teamAssignment.progress ?? 0,
      status: teamAssignment.status,
      deadline: project.deadline,
      difficulty: project.difficulty,
    };
  }, [developerTeam, assignments, projects]);

  // Calculate task statistics
  const taskStats = useMemo(() => {
    const total = individualTasks.length + bountyStats.myActive.length;
    const completed = individualTasks.filter((t) => t.status === 'completed').length + bountyStats.myCompleted.length;
    const inProgress = individualTasks.filter((t) => t.status === 'in-progress').length + bountyStats.myActive.length;
    const notStarted = individualTasks.filter((t) => t.status === 'pending' || t.status === 'not-started').length;
    
    return { total, completed, inProgress, notStarted };
  }, [individualTasks, bountyStats]);

  const completionRate = taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0;

  // Bounty handlers
  const handleClaimBounty = async (bountyId: string) => {
    setIsClaiming(bountyId);
    try {
      const developerId = developerProfile?.id || state.uid || '';
      const developerName = state.name || state.email || 'Developer';
      await claimBounty(bountyId, developerId, developerName);
      
      // Reload bounties
      const response = await listBounties();
      setBounties(response.bounties || []);
    } catch (error) {
      console.error('Failed to claim bounty:', error);
    } finally {
      setIsClaiming(null);
    }
  };

  const handleCompleteBounty = async (bountyId: string) => {
    setIsCompleting(bountyId);
    try {
      await completeBounty(bountyId);
      
      // Reload bounties
      const response = await listBounties();
      setBounties(response.bounties || []);
    } catch (error) {
      console.error('Failed to complete bounty:', error);
    } finally {
      setIsCompleting(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Developer Dashboard</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Welcome back, {developerProfile?.displayName || state.name || state.email}
        </p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-6">
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-neon-teal/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Total Tasks</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">{taskStats.total}</div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-neon-purple/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">In Progress</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">{taskStats.inProgress}</div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-neon-orange/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Completed</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">{taskStats.completed}</div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-yellow-400/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Points Earned</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">{bountyStats.totalPointsEarned}</div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-10 bg-foreground/80 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Completion</div>
          <div className="mt-3 text-4xl font-semibold text-foreground">
            {Math.round(completionRate)}%
          </div>
        </GlassCard>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* My Tasks - 2 columns */}
        <div className="col-span-2 space-y-6">
          {/* Assigned Tasks */}
          <GlassCard>
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">My Assigned Tasks</h3>
                <p className="text-sm text-foreground/60">Team project tasks</p>
              </div>
            </header>

            <div className="mt-6 space-y-3">
              {individualTasks.length === 0 && (
                <div className="rounded-xl border border-black/5 bg-white/70 p-5 text-sm text-foreground/60">
                  No tasks assigned yet
                </div>
              )}
              {individualTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-black/5 bg-white/70 p-4 shadow-sm transition-all hover:border-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{task.title}</h4>
                      <p className="mt-1 text-sm text-foreground/60">{task.description}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-foreground/50">
                        <span>{task.projectTitle}</span>
                        <span>{task.estimatedHours}h</span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider',
                        task.status === 'completed' && 'border-green-300 bg-green-50 text-green-700',
                        task.status === 'in-progress' && 'border-blue-300 bg-blue-50 text-blue-700',
                        !['completed', 'in-progress'].includes(task.status) && 'border-gray-300 bg-gray-50 text-gray-600'
                      )}
                    >
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* My Active Bounties */}
          <GlassCard>
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">My Active Bounties</h3>
                <p className="text-sm text-foreground/60">{bountyStats.myActive.length} in progress</p>
              </div>
            </header>

            <div className="mt-6 space-y-3">
              {bountyStats.myActive.length === 0 && (
                <div className="rounded-xl border border-black/5 bg-white/70 p-5 text-sm text-foreground/60">
                  No active bounties. Browse available bounties below!
                </div>
              )}
              {bountyStats.myActive.map((bounty) => (
                <div
                  key={bounty.id}
                  className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{bounty.title}</h4>
                      <p className="mt-1 text-sm text-foreground/60">{bounty.description}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-foreground/50">
                        <span>{bounty.estimatedHours}h</span>
                        {bounty.reward && <span className="font-semibold text-yellow-600">{bounty.reward} pts</span>}
                        <span className="rounded-full bg-black/5 px-2 py-0.5 uppercase">{bounty.priority}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCompleteBounty(bounty.id)}
                      disabled={isCompleting === bounty.id}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      {isCompleting === bounty.id ? 'Completing...' : 'Complete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Team Progress - 1 column */}
        <div className="col-span-1 space-y-6">
          <GlassCard>
            <header>
              <h3 className="text-lg font-semibold text-foreground">Team Progress</h3>
              <p className="text-sm text-foreground/60">
                {developerTeam?.name || 'No team assigned'}
              </p>
            </header>

            <div className="mt-6 space-y-4">
              {!teamProject && (
                <div className="rounded-xl border border-black/5 bg-white/70 p-4 text-sm text-foreground/60">
                  No active team project
                </div>
              )}

              {teamProject && (
                <>
                  <div className="rounded-xl border border-black/5 bg-white/70 p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-foreground">{teamProject.title}</h4>
                    <div className="mt-2 flex items-center gap-2">
                      {teamProject.difficulty && (
                        <span className="rounded-full border border-black/10 bg-white/90 px-3 py-1 text-[10px] uppercase tracking-wider text-foreground/60">
                          {teamProject.difficulty}
                        </span>
                      )}
                      <span className="rounded-full border border-black/20 bg-black/5 px-3 py-1 text-[10px] uppercase tracking-wider text-foreground">
                        {teamProject.status}
                      </span>
                    </div>
                    
                    {teamProject.deadline && (
                      <div className="mt-3 text-xs text-foreground/50">
                        Deadline: {new Date(teamProject.deadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-foreground/50">Progress</span>
                      <span className="font-semibold text-foreground">{teamProject.progress}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-black transition-all"
                        style={{ width: `${Math.min(teamProject.progress, 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </GlassCard>

          {/* Bounty Stats */}
          <GlassCard>
            <header>
              <h3 className="text-lg font-semibold text-foreground">Bounty Stats</h3>
            </header>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between rounded-lg bg-white/70 p-3">
                <span className="text-sm text-foreground/60">Active</span>
                <span className="text-sm font-semibold">{bountyStats.myActive.length}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-white/70 p-3">
                <span className="text-sm text-foreground/60">Completed</span>
                <span className="text-sm font-semibold">{bountyStats.myCompleted.length}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-white/70 p-3">
                <span className="text-sm text-foreground/60">Total Points</span>
                <span className="text-sm font-semibold text-yellow-600">{bountyStats.totalPointsEarned}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Available Bounties Grid */}
      <GlassCard>
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Available Bounties</h3>
            <p className="text-sm text-foreground/60">{bountyStats.available.length} bounties available</p>
          </div>
          <button
            onClick={() => navigate('/developer/side-bounties')}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            View All
          </button>
        </header>

        {isLoadingBounties ? (
          <div className="mt-6 text-center text-foreground/60">Loading bounties...</div>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-4">
            {bountyStats.available.slice(0, 6).map((bounty) => (
              <div
                key={bounty.id}
                className="rounded-xl border border-black/10 bg-white/80 p-4 shadow-sm transition-all hover:shadow-md hover:border-black/20"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold text-foreground leading-tight">{bounty.title}</h4>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider',
                      bounty.priority === 'high' && 'bg-black text-white',
                      bounty.priority === 'medium' && 'bg-gray-400 text-white',
                      bounty.priority === 'low' && 'bg-gray-200 text-gray-800'
                    )}
                  >
                    {bounty.priority}
                  </span>
                </div>
                
                <p className="text-sm text-foreground/60 line-clamp-2 mb-3">{bounty.description}</p>
                
                <div className="flex items-center gap-2 text-xs text-foreground/50 mb-3">
                  <span>{bounty.estimatedHours}h</span>
                  {bounty.reward && <span className="font-semibold text-yellow-600">{bounty.reward} pts</span>}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {bounty.skills.slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-foreground/70"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleClaimBounty(bounty.id)}
                  disabled={isClaiming === bounty.id}
                  className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                >
                  {isClaiming === bounty.id ? 'Claiming...' : 'Claim Bounty'}
                </button>
              </div>
            ))}
          </div>
        )}

        {!isLoadingBounties && bountyStats.available.length === 0 && (
          <div className="mt-6 text-center rounded-xl border border-black/5 bg-white/70 p-8">
            <p className="text-foreground/60">No bounties available at the moment</p>
            <p className="text-sm text-foreground/40 mt-1">Check back later for new opportunities</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
