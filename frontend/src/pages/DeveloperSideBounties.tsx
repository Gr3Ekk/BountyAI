import { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuth } from '../context/AuthContext';
import { listBounties, claimBounty, completeBounty, type BountyResponse } from '../lib/backendApi';
import { cn } from '../lib/utils';

export function DeveloperSideBounties() {
  const { state } = useAuth();
  const developerId = state.uid ?? '';
  const developerName = state.name ?? 'Developer';
  const [bounties, setBounties] = useState<BountyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string>('all');

  useEffect(() => {
    document.title = 'Side Bounties • BountyAI';
    loadBounties();
    return () => {
      document.title = 'BountyAI';
    };
  }, [selectedSkill]);

  const loadBounties = async () => {
    setIsLoading(true);
    try {
      const params = selectedSkill !== 'all' ? { skill: selectedSkill } : undefined;
      const response = await listBounties(params);
      setBounties(response.bounties);
    } catch (err) {
      console.error('Failed to load bounties:', err);
      setError('Failed to load bounties');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimBounty = async (bountyId: string) => {
    setIsClaiming(bountyId);
    setError(null);

    try {
      await claimBounty(bountyId, developerId, developerName);
      await loadBounties(); // Reload to get updated status
    } catch (err) {
      console.error('Failed to claim bounty:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim bounty');
    } finally {
      setIsClaiming(null);
    }
  };

  const handleCompleteBounty = async (bountyId: string) => {
    setIsCompleting(bountyId);
    setError(null);

    try {
      await completeBounty(bountyId);
      await loadBounties(); // Reload to get updated status
    } catch (err) {
      console.error('Failed to complete bounty:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete bounty');
    } finally {
      setIsCompleting(null);
    }
  };

  const availableBounties = bounties.filter((b) => b.status === 'available' || b.status === 'open');
  const myBounties = bounties.filter((b) => b.status === 'claimed' && b.claimedBy === developerId);
  const completedBounties = bounties.filter((b) => b.status === 'completed' && b.claimedBy === developerId);

  // Extract all unique skills from bounties for filter
  const allSkills = Array.from(
    new Set(bounties.flatMap((b) => b.skills))
  ).sort();

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Side Bounties</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Browse and self-assign quick tasks
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="border-l-4 border-l-neon-teal">
          <div className="text-2xl font-bold text-foreground">{availableBounties.length}</div>
          <div className="text-xs uppercase tracking-wider text-foreground/60">Available</div>
        </GlassCard>
        <GlassCard className="border-l-4 border-l-yellow-500">
          <div className="text-2xl font-bold text-foreground">{myBounties.length}</div>
          <div className="text-xs uppercase tracking-wider text-foreground/60">My Active</div>
        </GlassCard>
        <GlassCard className="border-l-4 border-l-green-500">
          <div className="text-2xl font-bold text-foreground">{completedBounties.length}</div>
          <div className="text-xs uppercase tracking-wider text-foreground/60">Completed</div>
        </GlassCard>
      </div>

      {/* Skill Filter */}
      {allSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-foreground/60">
            Filter by skill:
          </span>
          <button
            onClick={() => setSelectedSkill('all')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition',
              selectedSkill === 'all'
                ? 'bg-neon-teal/90 text-white'
                : 'bg-white/80 text-foreground/70 hover:bg-foreground/5'
            )}
          >
            All
          </button>
          {allSkills.map((skill) => (
            <button
              key={skill}
              onClick={() => setSelectedSkill(skill)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                selectedSkill === skill
                  ? 'bg-neon-teal/90 text-white'
                  : 'bg-white/80 text-foreground/70 hover:bg-foreground/5'
              )}
            >
              {skill}
            </button>
          ))}
        </div>
      )}

      {/* Bounty List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-foreground/60">
          Loading bounties...
        </div>
      ) : bounties.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <div className="text-lg font-semibold text-foreground">No bounties available</div>
          <div className="mt-1 text-sm text-foreground/60">
            Check back later for new opportunities
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {/* My Active Bounties */}
          {myBounties.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-wider text-foreground">
                My Active Bounties
              </h2>
              <div className="grid gap-4">
                {myBounties.map((bounty) => (
                  <GlassCard key={bounty.id} className="border-yellow-500/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">{bounty.title}</h3>
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider',
                              bounty.priority === 'high' && 'bg-red-500/10 text-red-600',
                              bounty.priority === 'medium' && 'bg-yellow-500/10 text-yellow-600',
                              bounty.priority === 'low' && 'bg-gray-500/10 text-gray-600'
                            )}
                          >
                            {bounty.priority}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-foreground/70">{bounty.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-foreground/60">
                          <span>⏱ {bounty.estimatedHours}h</span>
                          {bounty.reward && <span>⭐ {bounty.reward} pts</span>}
                          {bounty.deadline && (
                            <span>📅 {new Date(bounty.deadline).toLocaleDateString()}</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {bounty.skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs text-foreground/70"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCompleteBounty(bounty.id)}
                        disabled={isCompleting === bounty.id}
                        className="rounded-xl border border-green-500/40 bg-green-500/90 px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCompleting === bounty.id ? 'Completing...' : '✓ Complete'}
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Available Bounties */}
          {availableBounties.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-wider text-foreground">
                Available Bounties
              </h2>
              <div className="grid gap-4">
                {availableBounties.map((bounty) => (
                  <GlassCard key={bounty.id} className="hover:border-neon-teal/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">{bounty.title}</h3>
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider',
                              bounty.priority === 'high' && 'bg-red-500/10 text-red-600',
                              bounty.priority === 'medium' && 'bg-yellow-500/10 text-yellow-600',
                              bounty.priority === 'low' && 'bg-gray-500/10 text-gray-600'
                            )}
                          >
                            {bounty.priority}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-foreground/70">{bounty.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-foreground/60">
                          <span>⏱ {bounty.estimatedHours}h</span>
                          {bounty.reward && <span>⭐ {bounty.reward} pts</span>}
                          {bounty.deadline && (
                            <span>📅 {new Date(bounty.deadline).toLocaleDateString()}</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {bounty.skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs text-foreground/70"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleClaimBounty(bounty.id)}
                        disabled={isClaiming === bounty.id}
                        className="rounded-xl border border-neon-teal/40 bg-neon-teal/90 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isClaiming === bounty.id ? 'Claiming...' : '→ Claim'}
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Completed Bounties */}
          {completedBounties.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-wider text-foreground">
                My Completed Bounties
              </h2>
              <div className="grid gap-4">
                {completedBounties.map((bounty) => (
                  <GlassCard key={bounty.id} className="border-green-500/20 opacity-80">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{bounty.title}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-foreground/60">
                          <span>⏱ {bounty.estimatedHours}h</span>
                          {bounty.reward && <span>⭐ {bounty.reward} pts</span>}
                        </div>
                      </div>
                      <span className="text-2xl">✓</span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
