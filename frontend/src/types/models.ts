export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'legendary' | string;
export type ProjectStatus =
  | 'draft'
  | 'open'
  | 'assigned'
  | 'in-progress'
  | 'blocked'
  | 'completed'
  | 'archived'
  | string;
export type AssignmentStatus =
  | 'proposed'
  | 'accepted'
  | 'in-progress'
  | 'blocked'
  | 'completed'
  | string;

// Task type classification
export type TaskType = 'team-assignment' | 'bounty';

// Bounty status lifecycle
export type BountyStatus = 'open' | 'claimed' | 'in-progress' | 'review' | 'completed' | 'cancelled';

// Task priority levels
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Team {
  id: string;
  name: string;
  description?: string;
  skills: string[];
  productivityScore?: number;
  productivity_rate?: number;
  currentWorkload?: number;
  current_workload?: number;
  maxCapacity?: number;
  max_capacity?: number;
  joinCode?: string;
  leadUid?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: string;
  title: string;
  name?: string;
  description: string;
  difficulty: DifficultyLevel;
  skillsRequired: string[];
  required_skills?: string[];
  estimatedHours?: number;
  estimated_hours?: number;
  reward?: number;
  status: ProjectStatus;
  assignedTeamId?: string | null;
  deadline?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  projectId: string;
  teamId: string;
  tenantId?: string;
  status: AssignmentStatus;
  fitScore?: number;
  reasoning?: string;
  developerIds?: string[];
  progress?: number;
  startDate?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Developer {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
  skills: string[];
  primaryTeamId?: string;
  teamName?: string;
  timezone?: string;
  availability?: {
    hoursPerWeek?: number;
    updatedAt?: string;
  };
  activeAssignmentCount?: number;
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManagerProfile {
  id: string;
  displayName: string;
  email: string;
  organization?: string;
  roles: string[];
  tenantId?: string;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Task interface with support for both team assignments and bounties
export interface Task {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  skills: string[];
  type: TaskType;
  priority?: TaskPriority;
  
  // For team assignments
  assignedToId?: string;
  assignedToName?: string;
  teamId?: string;
  
  // For bounties
  isPublic?: boolean;
  claimedBy?: string;
  claimedByName?: string;
  claimedAt?: number;
  status?: BountyStatus;
  
  // Common fields
  projectId?: string;
  assignmentId?: string;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
  deadline?: string;
}

// Bounty-specific interface extending Task
export interface Bounty extends Task {
  type: 'bounty';
  isPublic: true;
  status: BountyStatus;
  reward?: number;
  requiredSkills: string[];
  linkedProjectId?: string;
}

// Assignment task interface
export interface AssignmentTask extends Task {
  type: 'team-assignment';
  assignedToId: string;
  assignedToName: string;
  teamId: string;
}
