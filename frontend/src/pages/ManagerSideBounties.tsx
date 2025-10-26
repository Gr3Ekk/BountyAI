import { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { createBounty, listBounties, type BountyPayload, type BountyResponse } from '../lib/backendApi';
import { cn } from '../lib/utils';

export function ManagerSideBounties() {
  const [bounties, setBounties] = useState<BountyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(8);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [reward, setReward] = useState<number | undefined>(undefined);
  const [deadline, setDeadline] = useState<string>('');

  useEffect(() => {
    document.title = 'Side Bounties • BountyAI';
    loadBounties();
    return () => {
      document.title = 'BountyAI';
    };
  }, []);

  const loadBounties = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listBounties();
      setBounties(response.bounties || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load bounties:', err);
      // Don't show error if bounties is empty, just show empty state
      setBounties([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim() || skills.length === 0) {
      setError('Please fill in all required fields (title, description, skills)');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const payload: BountyPayload = {
        title: title.trim(),
        description: description.trim(),
        estimatedHours,
        skills,
        priority,
        reward,
        deadline: deadline || undefined,
      };

      await createBounty(payload);
      
      // Reset form
      setTitle('');
      setDescription('');
      setEstimatedHours(8);
      setSkills([]);
      setPriority('medium');
      setReward(undefined);
      setDeadline('');
      setShowCreateForm(false);
      
      // Reload bounties
      await loadBounties();
    } catch (err) {
      console.error('Failed to create bounty:', err);
      setError(err instanceof Error ? err.message : 'Failed to create bounty');
    } finally {
      setIsCreating(false);
    }
  };

  const availableBounties = bounties.filter((b) => b.status === 'available' || b.status === 'open');
  const claimedBounties = bounties.filter((b) => b.status === 'claimed');
  const completedBounties = bounties.filter((b) => b.status === 'completed');

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Side Bounties</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Create quick tasks that developers can self-assign
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          {showCreateForm ? 'Cancel' : 'Create Bounty'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <GlassCard className="border-black/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Create New Bounty</h2>
            
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/70">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-foreground/10 bg-white/80 px-4 py-2.5 text-sm focus:border-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                placeholder="e.g. Fix login bug on mobile"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/70">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-foreground/10 bg-white/80 px-4 py-2.5 text-sm focus:border-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                placeholder="Describe the bounty task in detail..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Estimated Hours *
                </label>
                <input
                  type="number"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full rounded-xl border border-foreground/10 bg-white/80 px-4 py-2.5 text-sm focus:border-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-full rounded-xl border border-foreground/10 bg-white/80 px-4 py-2.5 text-sm focus:border-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Points Reward (optional)
                </label>
                <input
                  type="number"
                  value={reward ?? ''}
                  onChange={(e) => setReward(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Points"
                  className="w-full rounded-xl border border-foreground/10 bg-white/80 px-4 py-2.5 text-sm focus:border-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/70">
                  Deadline (optional)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-xl border border-foreground/10 bg-white/80 px-4 py-2.5 text-sm focus:border-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/70">
                Required Skills *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  className="flex-1 rounded-xl border border-foreground/10 bg-white/80 px-4 py-2.5 text-sm focus:border-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                  placeholder="e.g. React, Python, UI/UX"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="rounded-xl border border-foreground/20 bg-white/80 px-4 py-2.5 text-sm font-medium transition hover:border-foreground/40"
                >
                  Add
                </button>
              </div>
              
              {skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-black"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="ml-1 text-black/60 hover:text-black"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setError(null);
                }}
                className="rounded-xl border border-foreground/20 bg-white/80 px-5 py-2.5 text-sm font-medium transition hover:border-foreground/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? 'Creating...' : 'Create Bounty'}
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="border-l-4 border-l-black">
          <div className="text-2xl font-bold text-foreground">{availableBounties.length}</div>
          <div className="text-xs uppercase tracking-wider text-foreground/60">Available</div>
        </GlassCard>
        <GlassCard className="border-l-4 border-l-black">
          <div className="text-2xl font-bold text-foreground">{claimedBounties.length}</div>
          <div className="text-xs uppercase tracking-wider text-foreground/60">In Progress</div>
        </GlassCard>
        <GlassCard className="border-l-4 border-l-black">
          <div className="text-2xl font-bold text-foreground">{completedBounties.length}</div>
          <div className="text-xs uppercase tracking-wider text-foreground/60">Completed</div>
        </GlassCard>
      </div>

      {/* Bounty List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-foreground/60">
          Loading bounties...
        </div>
      ) : bounties.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-lg font-semibold text-foreground">No bounties yet</div>
          <div className="mt-1 text-sm text-foreground/60">
            Create your first side bounty to get started
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {/* Available Bounties */}
          {availableBounties.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-wider text-foreground">
                Available Bounties
              </h2>
              <div className="grid gap-4">
                {availableBounties.map((bounty) => (
                  <GlassCard key={bounty.id} className="hover:border-black/30">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">{bounty.title}</h3>
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider',
                              bounty.priority === 'high' && 'bg-black text-white',
                              bounty.priority === 'medium' && 'bg-gray-400 text-white',
                              bounty.priority === 'low' && 'bg-gray-200 text-gray-800'
                            )}
                          >
                            {bounty.priority}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-foreground/70">{bounty.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-foreground/60">
                          <span>{bounty.estimatedHours}h</span>
                          {bounty.reward && <span>{bounty.reward} pts</span>}
                          {bounty.deadline && (
                            <span>{new Date(bounty.deadline).toLocaleDateString()}</span>
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
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* In Progress Bounties */}
          {claimedBounties.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-wider text-foreground">
                In Progress
              </h2>
              <div className="grid gap-4">
                {claimedBounties.map((bounty) => (
                  <GlassCard key={bounty.id} className="border-black/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{bounty.title}</h3>
                        <p className="mt-1 text-sm text-foreground/60">
                          Claimed by: {bounty.claimedByName || 'Unknown'}
                        </p>
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
                Completed
              </h2>
              <div className="grid gap-4">
                {completedBounties.map((bounty) => (
                  <GlassCard key={bounty.id} className="border-black/20 opacity-80">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{bounty.title}</h3>
                        <p className="mt-1 text-sm text-foreground/60">
                          Completed by: {bounty.claimedByName || 'Unknown'}
                        </p>
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
