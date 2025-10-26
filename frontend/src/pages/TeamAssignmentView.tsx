import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import type { Task, Developer, TaskType } from '../types/models';
import { useTenantTeams, useTenantDevelopers, useTenantProjects } from '../hooks/useTenantData';
import { finalizeAssignment, type FinalizeAssignmentTask } from '../lib/backendApi';
import { fetchAssignmentById, fetchBountiesForAssignment } from '../lib/firestoreData';
import { useAuth } from '../context/AuthContext';

interface AssignmentData {
  assignmentId: string;
  projectId: string;
  projectTitle: string;
  teamId: string;
  teamName: string;
  tasks: Task[];
  reasoning?: string;
}

export function TeamAssignmentView() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const tenantId = state.tenantId ?? 'default';
  const { data: teams = [] } = useTenantTeams({ tenantId });
  const { data: developers = [] } = useTenantDevelopers({ tenantId });
  const { data: projects = [] } = useTenantProjects({ tenantId });
  
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(null);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [bountyTasks, setBountyTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load assignment data
  useEffect(() => {
    if (!assignmentId) return;

    const loadData = async () => {
      setIsLoading(true);
      
      // First try sessionStorage (set by ManagerAICopilot after assignment)
      const cachedData = sessionStorage.getItem(`assignment_${assignmentId}`);
      
      if (cachedData) {
        try {
          const data: AssignmentData = JSON.parse(cachedData);
          setAssignmentData(data);
          
          // Split tasks by type
          const team = data.tasks.filter(t => t.type === 'team-assignment');
          const bounties = data.tasks.filter(t => t.type === 'bounty');
          setTeamTasks(team);
          setBountyTasks(bounties);
          setIsLoading(false);
          return;
        } catch (err) {
          console.error('Failed to parse cached data:', err);
        }
      }
      
      // Fallback to Firestore
      try {
        const [assignment, bounties] = await Promise.all([
          fetchAssignmentById(tenantId, assignmentId),
          fetchBountiesForAssignment(tenantId, assignmentId),
        ]);
        
        if (!assignment) {
          setError('Assignment not found');
          setIsLoading(false);
          return;
        }
        
        // Find project details
        const project = projects.find(p => p.id === assignment.projectId);
        const team = teams.find(t => t.id === assignment.teamId);
        
        const data: AssignmentData = {
          assignmentId: assignment.id,
          projectId: assignment.projectId,
          projectTitle: project?.title || project?.name || 'Project',
          teamId: assignment.teamId,
          teamName: team?.name || 'Unknown Team',
          tasks: assignment.tasks || [],
          reasoning: assignment.reasoning,
        };
        
        setAssignmentData(data);
        
        // Combine team tasks from assignment with bounties from separate collection
        const teamTasksFromAssignment = (assignment.tasks || []).filter(
          (t: Task) => t.type === 'team-assignment'
        );
        const bountyTasksFromBounties = bounties.map((b: any) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          estimatedHours: b.estimatedHours,
          skills: b.skills || [],
          type: 'bounty' as TaskType,
          priority: b.priority || 'medium',
          status: b.status || 'open',
        }));
        
        setTeamTasks(teamTasksFromAssignment);
        setBountyTasks(bountyTasksFromBounties);
        
      } catch (err) {
        console.error('Failed to load assignment from Firestore:', err);
        setError('Failed to load assignment data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [assignmentId, tenantId, projects, teams]);


  const currentTeam = teams.find(t => t.id === assignmentData?.teamId);
  const teamMembers = developers.filter(d => d.primaryTeamId === assignmentData?.teamId);

  const handleTaskTypeChange = (taskId: string, newType: TaskType) => {
    const updateTasks = (tasks: Task[]) => {
      return tasks.map(task => {
        if (task.id === taskId) {
          const updated = { ...task, type: newType };
          // If converting to bounty, remove assignment
          if (newType === 'bounty') {
            delete updated.assignedToId;
            delete updated.assignedToName;
            updated.status = 'open';
          }
          // If converting to team task, need to assign to someone
          if (newType === 'team-assignment' && !updated.assignedToId && teamMembers.length > 0) {
            updated.assignedToId = teamMembers[0].id;
            updated.assignedToName = teamMembers[0].displayName;
            delete updated.status; // Team tasks don't have status field
          }
          return updated;
        }
        return task;
      });
    };

    setTeamTasks(prev => updateTasks(prev));
    setBountyTasks(prev => updateTasks(prev));

    // Move task between lists
    if (newType === 'bounty') {
      const task = teamTasks.find(t => t.id === taskId);
      if (task) {
        const updated = { ...task, type: 'bounty' as TaskType };
        delete updated.assignedToId;
        delete updated.assignedToName;
        updated.status = 'open';
        setTeamTasks(prev => prev.filter(t => t.id !== taskId));
        setBountyTasks(prev => [...prev, updated]);
      }
    } else {
      const task = bountyTasks.find(t => t.id === taskId);
      if (task) {
        const updated: Task = { 
          ...task, 
          type: 'team-assignment' as TaskType,
          assignedToId: teamMembers[0]?.id,
          assignedToName: teamMembers[0]?.displayName,
        };
        delete updated.status; // Team tasks don't have status
        setBountyTasks(prev => prev.filter(t => t.id !== taskId));
        setTeamTasks(prev => [...prev, updated]);
      }
    }
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    if (updatedTask.type === 'bounty') {
      setBountyTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    } else {
      setTeamTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    }
    setSelectedTask(null);
    setIsEditingTask(false);
  };

  const handleDeleteTask = (taskId: string) => {
    setTeamTasks(prev => prev.filter(t => t.id !== taskId));
    setBountyTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTask(null);
    setIsEditingTask(false);
  };

  const handleAddTask = () => {
    const newTask: Task = {
      id: `task_${Date.now()}`,
      title: 'New Task',
      description: 'Task description',
      estimatedHours: 2,
      skills: [],
      type: 'team-assignment',
      priority: 'medium',
      assignedToId: teamMembers[0]?.id,
      assignedToName: teamMembers[0]?.displayName,
    };
    setTeamTasks(prev => [...prev, newTask]);
    setSelectedTask(newTask);
    setIsEditingTask(true);
  };

  // Auto-distribute tasks to all team members
  const handleAutoAssign = () => {
    if (teamMembers.length === 0 || teamTasks.length === 0) return;
    
    const updatedTasks = teamTasks.map((task, index) => {
      const memberIndex = index % teamMembers.length;
      const member = teamMembers[memberIndex];
      return {
        ...task,
        assignedToId: member.id,
        assignedToName: member.displayName,
      };
    });
    
    setTeamTasks(updatedTasks);
  };

  const handleFinalize = async () => {
    if (!assignmentData) return;
    
    setIsFinalizing(true);
    setError(null);

    try {
      // Auto-assign tasks if not already assigned
      let tasksToFinalize = teamTasks;
      
      // Check if any tasks are unassigned
      const hasUnassignedTasks = teamTasks.some(task => !task.assignedToId);
      
      if (hasUnassignedTasks && teamMembers.length > 0) {
        // Auto-assign using round-robin distribution
        tasksToFinalize = teamTasks.map((task, index) => {
          if (task.assignedToId) return task; // Keep existing assignment
          
          const memberIndex = index % teamMembers.length;
          const member = teamMembers[memberIndex];
          return {
            ...task,
            assignedToId: member.id,
            assignedToName: member.displayName,
          };
        });
        
        // Update state so UI reflects the assignments
        setTeamTasks(tasksToFinalize);
      }
      
      // Convert tasks to the format expected by backend
      const convertTask = (task: Task): FinalizeAssignmentTask => ({
        id: task.id,
        title: task.title,
        description: task.description,
        estimatedHours: task.estimatedHours,
        skills: task.skills,
        type: task.type,
        priority: task.priority,
        assignedToId: task.assignedToId,
        assignedToName: task.assignedToName,
        status: task.status,
      });

      const result = await finalizeAssignment({
        assignmentId: assignmentData.assignmentId,
        projectId: assignmentData.projectId,
        teamId: assignmentData.teamId,
        teamTasks: tasksToFinalize.map(convertTask),
        bountyTasks: bountyTasks.map(convertTask),
      });

      console.log('Assignment finalized:', result);

      // Clear cached data
      sessionStorage.removeItem(`assignment_${assignmentId}`);
      
      // Show success message briefly before navigating
      const successMessage = `✅ ${result.message}`;
      setError(null);
      
      // Navigate back to dashboard
      setTimeout(() => {
        navigate('/manager/dashboard');
      }, 1500);

      // You could show a toast notification here instead
      alert(successMessage);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to finalize assignment';
      setError(message);
      console.error('Finalization error:', err);
    } finally {
      setIsFinalizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-foreground/60">Loading assignment...</div>
      </div>
    );
  }

  if (!assignmentData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <GlassCard className="max-w-md p-8 text-center">
          <h2 className="text-xl font-bold text-foreground">Assignment Not Found</h2>
          <p className="mt-2 text-foreground/60">The assignment you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/manager/dashboard')}
            className="mt-4 rounded-2xl border border-neon-teal/40 bg-neon-teal/90 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-background shadow-glow transition-transform hover:-translate-y-0.5"
          >
            Back to Dashboard
          </button>
        </GlassCard>
      </div>
    );
  }

  const totalHours = [...teamTasks, ...bountyTasks].reduce((sum, task) => sum + task.estimatedHours, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/manager/copilot')}
            className="mb-4 text-sm text-foreground/60 transition hover:text-foreground"
          >
            ← Back to Copilot
          </button>
          <h1 className="text-3xl font-bold text-foreground">Team Assignment</h1>
          <p className="mt-1 text-foreground/60">{assignmentData.projectTitle}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Panel: Team Overview */}
          <div className="lg:col-span-1">
            <GlassCard className="p-6">
              <h2 className="text-xl font-bold text-foreground">Team Overview</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Team</div>
                  <div className="text-lg font-semibold text-neon-teal">{assignmentData.teamName}</div>
                </div>

                {assignmentData.reasoning && (
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Why This Team</div>
                    <p className="mt-1 text-sm text-foreground/70">{assignmentData.reasoning}</p>
                  </div>
                )}

                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">Team Skills</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentTeam?.skills.map(skill => (
                      <span
                        key={skill}
                        className="rounded-full bg-neon-purple/10 px-3 py-1 text-xs text-neon-purple"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-foreground/50">
                    Members ({teamMembers.length})
                  </div>
                  <div className="mt-2 space-y-2">
                    {teamMembers.map(member => (
                      <div key={member.id} className="rounded-xl border border-foreground/10 bg-white/60 p-3">
                        <div className="font-semibold text-foreground">{member.displayName}</div>
                        <div className="mt-1 text-xs text-foreground/60">
                          {member.skills.join(', ')}
                        </div>
                        {member.availability?.hoursPerWeek && (
                          <div className="mt-1 text-xs text-foreground/50">
                            {member.availability.hoursPerWeek}h/week
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-foreground/10 bg-white/80 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground/60">Total Estimated</span>
                    <span className="text-lg font-bold text-foreground">{totalHours}h</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-foreground/60">Team Tasks</span>
                    <span className="font-semibold text-neon-teal">{teamTasks.length}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm text-foreground/60">Side Bounties</span>
                    <span className="font-semibold text-neon-purple">{bountyTasks.length}</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Right Panel: Task Lists */}
          <div className="lg:col-span-2">
            <GlassCard className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Task Breakdown</h2>
                <button
                  onClick={handleAddTask}
                  className="rounded-2xl border border-foreground/20 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground transition hover:border-foreground/40"
                >
                  + Add Task
                </button>
              </div>

              {/* Team Tasks Section */}
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-neon-teal"></div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-neon-teal">
                    Team Tasks ({teamTasks.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {teamTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      teamMembers={teamMembers}
                      onEdit={() => {
                        setSelectedTask(task);
                        setIsEditingTask(true);
                      }}
                      onConvert={() => handleTaskTypeChange(task.id, 'bounty')}
                      onDelete={() => handleDeleteTask(task.id)}
                    />
                  ))}
                  {teamTasks.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-foreground/10 p-6 text-center text-sm text-foreground/40">
                      No team tasks yet. Convert bounties or add new tasks.
                    </div>
                  )}
                </div>
              </div>

              {/* Bounties Section */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-neon-purple"></div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-neon-purple">
                    Side Bounties ({bountyTasks.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {bountyTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      teamMembers={teamMembers}
                      onEdit={() => {
                        setSelectedTask(task);
                        setIsEditingTask(true);
                      }}
                      onConvert={() => handleTaskTypeChange(task.id, 'team-assignment')}
                      onDelete={() => handleDeleteTask(task.id)}
                    />
                  ))}
                  {bountyTasks.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-foreground/10 p-6 text-center text-sm text-foreground/40">
                      No bounties yet. Simple tasks will be suggested as bounties.
                    </div>
                  )}
                </div>
                {bountyTasks.length > 0 && (
                  <p className="mt-3 text-xs text-foreground/60">
                    💡 Bounties will be posted to the public board for any developer to claim
                  </p>
                )}
              </div>

              {/* Finalize Button */}
              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => navigate('/manager/copilot')}
                  className="rounded-2xl border border-foreground/20 bg-white/80 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-foreground transition hover:border-foreground/40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAutoAssign}
                  disabled={teamTasks.length === 0 || teamMembers.length === 0}
                  className="rounded-2xl border border-neon-purple/40 bg-neon-purple/90 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-background transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Auto-Assign Tasks
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={isFinalizing || (teamTasks.length === 0 && bountyTasks.length === 0)}
                  className="rounded-2xl border border-neon-teal/40 bg-neon-teal/90 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-background shadow-glow transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFinalizing ? 'Finalizing...' : 'Finalize Assignment'}
                </button>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Task Edit Modal */}
      {isEditingTask && selectedTask && (
        <TaskEditModal
          task={selectedTask}
          teamMembers={teamMembers}
          onSave={handleTaskUpdate}
          onClose={() => {
            setSelectedTask(null);
            setIsEditingTask(false);
          }}
        />
      )}
    </div>
  );
}

// Task Card Component
interface TaskCardProps {
  task: Task;
  teamMembers: Developer[];
  onEdit: () => void;
  onConvert: () => void;
  onDelete: () => void;
}

function TaskCard({ task, teamMembers, onEdit, onConvert, onDelete }: TaskCardProps) {
  const isBounty = task.type === 'bounty';
  const assignedMember = teamMembers.find(m => m.id === task.assignedToId);

  return (
    <div className="group rounded-xl border border-foreground/10 bg-white/80 p-4 transition hover:border-foreground/20 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">{task.title}</h4>
              <p className="mt-1 text-sm text-foreground/60">{task.description}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wider ${
              task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
              task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
              task.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {task.priority}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-foreground/60">
            <span className="flex items-center gap-1">
              ⏱️ {task.estimatedHours}h
            </span>
            {!isBounty && assignedMember && (
              <span className="flex items-center gap-1">
                👤 {assignedMember.displayName}
              </span>
            )}
            {isBounty && (
              <span className="flex items-center gap-1 text-neon-purple">
                🌐 Public Bounty
              </span>
            )}
            {task.skills.length > 0 && (
              <span className="flex items-center gap-1">
                🔧 {task.skills.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-lg bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
            title="Edit task"
          >
            ✏️
          </button>
          <button
            onClick={onConvert}
            className="rounded-lg bg-purple-50 p-2 text-purple-600 transition hover:bg-purple-100"
            title={isBounty ? 'Convert to team task' : 'Convert to bounty'}
          >
            {isBounty ? '👥' : '🌐'}
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
            title="Delete task"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

// Task Edit Modal Component
interface TaskEditModalProps {
  task: Task;
  teamMembers: Developer[];
  onSave: (task: Task) => void;
  onClose: () => void;
}

function TaskEditModal({ task, teamMembers, onSave, onClose }: TaskEditModalProps) {
  const [editedTask, setEditedTask] = useState<Task>(task);

  const handleSave = () => {
    onSave(editedTask);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-foreground/10 bg-white p-8 shadow-2xl">
        <h3 className="text-2xl font-bold text-foreground">Edit Task</h3>
        
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-foreground/70">Title</label>
            <input
              type="text"
              value={editedTask.title}
              onChange={e => setEditedTask({ ...editedTask, title: e.target.value })}
              className="mt-1 w-full rounded-xl border border-foreground/20 bg-white px-4 py-2 text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground/70">Description</label>
            <textarea
              value={editedTask.description}
              onChange={e => setEditedTask({ ...editedTask, description: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-foreground/20 bg-white px-4 py-2 text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground/70">Estimated Hours</label>
              <input
                type="number"
                value={editedTask.estimatedHours}
                onChange={e => setEditedTask({ ...editedTask, estimatedHours: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.5"
                className="mt-1 w-full rounded-xl border border-foreground/20 bg-white px-4 py-2 text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground/70">Priority</label>
              <select
                value={editedTask.priority}
                onChange={e => setEditedTask({ ...editedTask, priority: e.target.value as Task['priority'] })}
                className="mt-1 w-full rounded-xl border border-foreground/20 bg-white px-4 py-2 text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {editedTask.type === 'team-assignment' && (
            <div>
              <label className="text-sm font-semibold text-foreground/70">Assigned To</label>
              <select
                value={editedTask.assignedToId || ''}
                onChange={e => {
                  const member = teamMembers.find(m => m.id === e.target.value);
                  setEditedTask({
                    ...editedTask,
                    assignedToId: member?.id,
                    assignedToName: member?.displayName,
                  });
                }}
                className="mt-1 w-full rounded-xl border border-foreground/20 bg-white px-4 py-2 text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
              >
                <option value="">Select team member...</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.displayName} - {member.skills.join(', ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-foreground/70">Required Skills</label>
            <input
              type="text"
              value={editedTask.skills.join(', ')}
              onChange={e => setEditedTask({ ...editedTask, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="e.g., react, typescript, design"
              className="mt-1 w-full rounded-xl border border-foreground/20 bg-white px-4 py-2 text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-foreground/20 bg-white px-6 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-foreground transition hover:border-foreground/40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-2xl border border-neon-teal/40 bg-neon-teal/90 px-6 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-background shadow-glow transition-transform hover:-translate-y-0.5"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
