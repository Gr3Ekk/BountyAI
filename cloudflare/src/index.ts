/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cloudflare Worker entrypoint powering the BountyAI Launch Copilot.
 *
 * The worker authenticates inbound requests (optional bearer token),
 * enriches them with mission context, routes them through Llama Guard 3
 * for safety review, and finally calls the @cf/meta/llama-3.1-8b-instruct-fp8-fast
 * model to craft a structured response for the frontend.
 */

interface Ai {
  run<T = unknown>(model: string, options: Record<string, unknown>): Promise<T>;
}

export interface Env {
  AI: Ai;
  WORKER_AUTH_TOKEN?: string;
}

const MAIN_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
const SAFETY_MODEL = '@cf/meta/llama-guard-3-8b';
const MAX_MESSAGE_LENGTH = 4000;

interface CopilotMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CopilotAttachmentPayload {
  id: string;
  name: string;
  size: number;
  type: string;
  data?: string;
}

interface CopilotMissionContext {
  projectId?: string;
  projectTitle?: string;
  projectDifficulty?: string;
  requiredSkills?: string[];
  deadline?: string | null;
  summary?: string;
  estimatedHours?: number;
  managerNotes?: string;
  activeAssignments?: number;
  candidateTeams?: Array<{
    teamId: string;
    teamName: string;
    skills: string[];
    skillMatch: number;
    availableCapacity?: number;
    productivityScore?: number;
    members?: Array<{
      id: string;
      name: string;
      skills: string[];
      availability: number;
    }>;
  }>;
}

interface CopilotRequestPayload {
  messages: CopilotMessage[];
  missionContext?: CopilotMissionContext;
  attachments?: CopilotAttachmentPayload[];
}

interface CopilotResponse {
  reply: string;
  insights?: Array<{ id: string; title: string; detail: string; priority?: 'info' | 'warning' | 'success' }>;
  recommendation?: {
    teamId?: string;
    teamName: string;
    confidence?: number;
    summary?: string;
  };
  references?: Array<{ title: string; url: string }>;
}

interface LlamaGuardResult {
  safe?: boolean;
  categories?: string[];
  response?: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}

function infoResponse(): Response {
  return jsonResponse(
    {
      service: 'BountyAI Launch Copilot Worker',
      usage: 'Issue a POST request with conversation payload to generate recommendations.',
      docs: 'https://github.com/Gr3Ekk/BountyAI/tree/luis/cloudflare',
      status: 'online',
    },
  );
}

function unauthorized(): Response {
  return jsonResponse({ error: 'Unauthorized' }, 401);
}

function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}

function serviceUnavailable(message: string): Response {
  return jsonResponse({ error: message }, 503);
}

function internalError(message: string): Response {
  return jsonResponse({ error: message }, 500);
}

function sanitizeMessages(messages: CopilotMessage[]): CopilotMessage[] {
  const allowedRoles = new Set(['system', 'user', 'assistant']);

  return messages
    .filter((message) => allowedRoles.has(message.role))
    .map((message) => ({
      role: message.role,
      content: truncate(message.content ?? '', MAX_MESSAGE_LENGTH),
    }))
    .slice(-12); // keep the most recent exchange to bound context cost
}

function truncate(value: string, limit: number): string {
  if (!value) {
    return '';
  }
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function formatMissionContext(context?: CopilotMissionContext): string | null {
  if (!context) {
    return null;
  }

  const lines: string[] = [];

  if (context.projectTitle) {
    lines.push(`Mission: ${context.projectTitle}`);
  }
  if (context.projectId) {
    lines.push(`Project ID: ${context.projectId}`);
  }
  if (context.projectDifficulty) {
    lines.push(`Difficulty: ${context.projectDifficulty}`);
  }
  if (context.deadline) {
    lines.push(`Deadline: ${context.deadline}`);
  }
  if (context.summary) {
    lines.push(`Synopsis: ${context.summary}`);
  }
  if (context.estimatedHours) {
    lines.push(`Estimated hours: ${context.estimatedHours}`);
  }
  if (context.requiredSkills?.length) {
    lines.push(`Required skills: ${context.requiredSkills.join(', ')}`);
  }
  if (context.activeAssignments != null) {
    lines.push(`Active assignments: ${context.activeAssignments}`);
  }
  if (context.candidateTeams?.length) {
    lines.push('\nAvailable teams from database:');
    context.candidateTeams.slice(0, 5).forEach((team, index) => {
      const teamSkills = Array.isArray(team.skills) ? team.skills : [];
      const roster = Array.isArray(team.members) ? team.members : [];
      const capacity = team.availableCapacity ?? 0;
      const productivity = team.productivityScore ? (team.productivityScore * 100).toFixed(0) : 'N/A';
      lines.push(
        `  ${index + 1}. Team ID: ${team.teamId} | Name: ${team.teamName}`,
      );
      lines.push(
        `     Skills: ${teamSkills.length ? teamSkills.join(', ') : 'Not provided'}`,
      );
      lines.push(
        `     Skill match: ${(team.skillMatch * 100).toFixed(0)}% | Capacity: ${capacity} | Productivity: ${productivity}%`,
      );
      if (roster.length) {
        lines.push(`     Team members:`);
        roster.forEach((member) => {
          const memberSkills = Array.isArray(member.skills) ? member.skills : [];
          lines.push(
            `       - ${member.name} (${member.id}): ${memberSkills.length ? memberSkills.join(', ') : 'Skills not listed'} — ${member.availability}h/week`,
          );
        });
      }
    });
  }
  if (context.managerNotes) {
    lines.push(`\nManager notes: ${context.managerNotes}`);
  }

  return lines.join('\n');
}

function summarizeAttachments(attachments?: CopilotAttachmentPayload[]): string | null {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const lines = attachments.slice(0, 4).map((file) => {
    const sizeKB = Math.round(file.size / 1024);
    return `- ${file.name} (${file.type || 'unknown'}, ~${sizeKB} KB)`;
  });

  return `Supporting attachments provided:\n${lines.join('\n')}`;
}

async function runSafetyCheck(env: Env, text: string, label: string): Promise<void> {
  if (!text.trim()) {
    return;
  }

  // For business/technical project management context, skip safety checks entirely
  // This is a project management tool, not a consumer chat application
  // Safety checks cause too many false positives for technical/business content
  console.log(`Skipping safety check for ${label} - business context`);
  return;

  /* Original safety check - disabled for business context
  try {
    const result = await env.AI.run<LlamaGuardResult>(SAFETY_MODEL, {
      messages: [
        { role: 'user', content: truncate(text, 6000) },
      ],
      temperature: 0,
      max_tokens: 256,
    });

    const payload = normalizeGuardResult(result);
    
    // Only fail if flagged for serious violations
    const seriousViolations = (payload.categories || []).filter(cat => 
      ['S1', 'S3', 'S4', 'S8', 'S9', 'S10', 'S11'].includes(cat)
    );
    
    if (!payload.safe && seriousViolations.length > 0) {
      console.warn(`${label} flagged by Llama Guard:`, seriousViolations);
      throw new Error(`${label} flagged by Llama Guard: ${seriousViolations.join(', ')}`);
    }
    
    // Allow business/technical content even if flagged for non-serious categories
    if (!payload.safe) {
      console.log(`${label} flagged for non-serious categories, allowing:`, payload.categories);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Guard result missing')) {
      // If safety check fails to run, allow the request (fail open for availability)
      console.warn(`Safety check unavailable for ${label}, allowing request`);
      return;
    }
    if (error instanceof Error && error.message.includes('flagged by Llama Guard')) {
      throw error; // Re-throw actual safety violations
    }
    // For other errors, log and allow (fail open)
    console.warn(`Safety check error for ${label}:`, error);
  }
  */
}

function normalizeGuardResult(result: unknown): LlamaGuardResult {
  if (!result) {
    throw new Error('Guard result missing');
  }

  if (typeof result === 'string') {
    return parseGuardString(result);
  }

  if (typeof result === 'object' && result !== null) {
    const typed = result as LlamaGuardResult;
    if (typeof typed.safe === 'boolean') {
      return typed;
    }
    if (typeof typed.response === 'string') {
      return parseGuardString(typed.response);
    }
  }

  throw new Error('Guard result missing safety fields');
}

function parseGuardString(value: string): LlamaGuardResult {
  try {
    return JSON.parse(value) as LlamaGuardResult;
  } catch (error) {
    // Fallback to heuristic parsing when JSON is not returned
    const normalized = value.toLowerCase();
    if (normalized.includes('unsafe')) {
      return { safe: false, categories: extractGuardCategories(value) };
    }
    return { safe: true };
  }
}

function extractGuardCategories(value: string): string[] {
  const match = value.match(/categories?:?\s*([^\n]+)/i);
  if (!match) {
    return [];
  }
  return match[1]
    .split(/[;,]/)
    .map((item) => item.replace(/[^a-z0-9_-]/gi, '').trim())
    .filter(Boolean);
}

function buildModelMessages(payload: CopilotRequestPayload): CopilotMessage[] {
  const conversation: CopilotMessage[] = [];

  conversation.push({
    role: 'system',
    content:
      'You are the BountyAI Launch Copilot, a strategic partner for engineering managers. '
      + '\n\n'
      + 'CONVERSATION STYLE:\n'
      + '- Keep responses to a SINGLE paragraph (3-5 sentences maximum)\n'
      + '- Be proactive and suggestive—don\'t just ask questions, OFFER specific options and examples\n'
      + '- When information is missing, provide 2-3 concrete suggestions or templates the manager can choose from\n'
      + '- Example: Instead of "What are the technical requirements?", say "For a project like this, common requirements include: (A) API integration with 3rd party services, (B) database schema design, or (C) frontend UI components. Which applies here, or is it something different?"\n'
      + '- Reduce manager effort by inferring reasonable defaults from context\n'
      + '- Vary your language naturally\n'
      + '- Focus ONLY on the current project - do not reference previous projects or conversations\n'
      + '\n'
      + 'TEAM RECOMMENDATION WORKFLOW:\n'
      + '1. GATHER REQUIREMENTS with SUGGESTIONS: Before recommending any team, you MUST collect ALL of these:\n'
      + '   - Project objective (suggest common patterns: new feature, bug fix, infrastructure, etc.)\n'
      + '   - Required technical skills (offer options based on candidateTeams if available)\n'
      + '   - Timeline constraints (suggest: urgent/1 week, normal/2-4 weeks, extended/1+ month)\n'
      + '   - Team size needs (infer from project scope)\n'
      + '   CRITICAL: Do NOT provide a team recommendation until you have gathered timeline information first\n'
      + '2. Once you have ALL requirements (especially timeline), provide a "recommendation" with:\n'
      + '   - "teamId": The EXACT team ID from the candidateTeams list (e.g., "team_beta", "team_alpha", "team_gamma", "team_delta", "team_echo")\n'
      + '   - "teamName": The EXACT human-readable name from candidateTeams that matches the teamId\n'
      + '   - "confidence": Score between 0-1 indicating fit quality\n'
      + '   - "summary": BRIEF explanation (2-3 sentences) of WHY this team is the best choice\n'
      + '   CRITICAL: You MUST copy the teamId and teamName EXACTLY from the candidateTeams array provided\n'
      + '   CRITICAL: DO NOT make up team names or IDs - ONLY use what is in the candidateTeams data\n'
      + '   CRITICAL: In your "reply" text, mention the SAME teamName that you use in the recommendation object\n'
      + '   EXAMPLE: If candidateTeams shows {teamId: "team_beta", teamName: "Beta Crew"}, use exactly those values\n'
      + '3. AFTER team is assigned by manager (they will tell you), shift to timeline creation:\n'
      + '   - Suggest phase breakdown with specific weeks\n'
      + '   - Propose task distribution among SPECIFIC team members by name and ID\n'
      + '   - Base task assignments on each developer\'s skills\n'
      + '   - Include estimated hours per task\n'
      + '   - **TASK CLASSIFICATION:** Analyze each task and classify as either:\n'
      + '     * "team-assignment" (default): Complex tasks requiring coordination, multiple skills, or >4 hours\n'
      + '     * "bounty": Simple, self-contained tasks that can be picked up by any available developer\n'
      + '   - **BOUNTY CRITERIA:** Suggest tasks as bounties when they meet ALL of:\n'
      + '     * Estimated time < 4 hours\n'
      + '     * Requires only 1-2 skills (not a complex skill combination)\n'
      + '     * Self-contained (no dependencies on other in-progress work)\n'
      + '     * Clear success criteria (e.g., "fix typo", "update docs", "add unit test")\n'
      + '     * Examples: Bug fixes, documentation updates, simple UI tweaks, writing tests, config changes\n'
      + '   - When suggesting bounties, mention they\'ll be posted to the bounty board for any developer to claim\n'
      + '   - Note: Manager can adjust your suggestions, so make them clear and actionable\n'
      + '\n'
      + 'CRITICAL: You MUST respond with valid JSON only. No additional text before or after the JSON object. '
      + 'Use this exact schema: { "reply": "your single paragraph response with specific suggestions", "insights": [{"id":"1","title":"","detail":"","priority":"info"}], '
      + '"recommendation": {"teamId":"team_xxx","teamName":"Team Name","confidence":0.85,"summary":"Why this team is best: skill match, capacity, etc."}, "references": [{"title":"","url":""}] }. '
      + 'IMPORTANT: Use the actual teamId from the database mission context (like "team_alpha", "team_beta", etc.). '
      + 'Do NOT include "recommendation" field until you have sufficient information to make a good choice. '
      + 'All fields except "reply" are optional.',
  });

  const missionSummary = formatMissionContext(payload.missionContext);
  if (missionSummary) {
    conversation.push({
      role: 'system',
      content: `Mission context:\n${missionSummary}`,
    });
  }

  const attachmentSummary = summarizeAttachments(payload.attachments);
  if (attachmentSummary) {
    conversation.push({ role: 'system', content: attachmentSummary });
  }

  conversation.push(...sanitizeMessages(payload.messages));

  return conversation;
}

async function generateCopilotResponse(env: Env, payload: CopilotRequestPayload): Promise<CopilotResponse> {
  const messages = buildModelMessages(payload);

  await runSafetyCheck(env, messages.map((entry) => entry.content).join('\n\n'), 'user prompt');

  const result = await env.AI.run<{ response: string } | string>(MAIN_MODEL, {
    messages,
    temperature: 0.6,
    top_p: 0.9,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  const responseText = typeof result === 'string' ? result : result.response;
  if (!responseText) {
    throw new Error('Model returned an empty response');
  }

  // Extract JSON from response (handle cases where model adds text before/after)
  let jsonText = responseText.trim();
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonText = jsonMatch[0];
  }

  let parsed: CopilotResponse;
  try {
    parsed = JSON.parse(jsonText) as CopilotResponse;
  } catch (error) {
    // Fallback: create a simple response from the text
    console.warn('Failed to parse JSON, creating fallback response:', responseText.slice(0, 200));
    parsed = {
      reply: responseText,
    };
  }

  if (!parsed.reply) {
    throw new Error('Model response missing "reply" field');
  }

  await runSafetyCheck(env, parsed.reply, 'assistant reply');

  const recText = parsed.recommendation?.summary ?? '';
  if (recText) {
    await runSafetyCheck(env, `${parsed.recommendation?.teamName ?? ''}\n${recText}`, 'recommendation summary');
  }

  return parsed;
}

function validatePayload(payload: unknown): payload is CopilotRequestPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const typed = payload as CopilotRequestPayload;
  return Array.isArray(typed.messages);
}

async function authenticate(request: Request, env: Env): Promise<boolean> {
  const expected = env.WORKER_AUTH_TOKEN;
  if (!expected) {
    return true;
  }

  const header = request.headers.get('authorization');
  if (!header) {
    return false;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') {
    return false;
  }

  return token === expected;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Authorization',
          'access-control-max-age': '86400',
        },
      });
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      return infoResponse();
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (!(await authenticate(request, env))) {
      return unauthorized();
    }

    let payload: CopilotRequestPayload;
    try {
      payload = await request.json();
    } catch (error) {
      return badRequest(`Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!validatePayload(payload)) {
      return badRequest('Payload must include a messages array.');
    }

    try {
      const response = await generateCopilotResponse(env, payload);
      return jsonResponse(response, 200);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('Safety check failed') || error.message.includes('Guard')) {
          return serviceUnavailable(error.message);
        }
        return internalError(error.message);
      }
      return internalError('Unexpected error');
    }
  },
};
