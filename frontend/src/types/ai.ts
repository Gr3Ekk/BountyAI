export type CopilotMessageRole = 'system' | 'manager' | 'assistant';

export interface CopilotAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface CopilotMessage {
  id: string;
  role: CopilotMessageRole;
  content: string;
  createdAt: number;
  attachments?: CopilotAttachment[];
  status?: 'ready' | 'pending' | 'error';
}

export interface CopilotInsight {
  id: string;
  title: string;
  detail: string;
  priority?: 'info' | 'warning' | 'success';
}

export interface CopilotRecommendation {
  teamId?: string;
  teamName: string;
  confidence?: number;
  summary?: string;
}

export interface CopilotResponse {
  reply: string;
  insights?: CopilotInsight[];
  recommendation?: CopilotRecommendation;
  references?: Array<{ title: string; url: string }>;
}

export interface CopilotMissionContext {
  projectId?: string;
  projectTitle?: string;
  projectDifficulty?: string;
  requiredSkills?: string[];
  deadline?: string | null;
  summary?: string;
  managerNotes?: string;
  activeAssignments?: number;
  candidateTeams?: Array<{
    teamId?: string;
    teamName: string;
    skills?: string[];
    skillMatch: number;
    availableCapacity?: number;
    productivityScore?: number;
    members?: Array<{
      id: string;
      name: string;
      skills?: string[];
      availability: number;
    }>;
  }>;
}

export interface CopilotAttachmentPayload extends CopilotAttachment {
  data?: string;
}

export interface CopilotRequestPayload {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  missionContext?: CopilotMissionContext;
  attachments?: CopilotAttachmentPayload[];
}
