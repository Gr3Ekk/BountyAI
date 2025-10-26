import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuth } from '../context/AuthContext';
import { useTenantProjects, useTenantTeams, useTenantDevelopers } from '../hooks/useTenantData';
import { useSpeechCapture } from '../hooks/useSpeechCapture';
import type { CopilotAttachmentPayload, CopilotMessage, CopilotRecommendation } from '../types/ai';
import { sendCopilotMessage } from '../lib/aiCopilotClient';
import { assignProjectToTeam } from '../lib/backendApi';
import { cn } from '../lib/utils';

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TOTAL_ATTACHMENTS = 4;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ManagerAICopilot() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const tenantId = state.tenantId ?? 'default';
  const { data: teams = [] } = useTenantTeams({ tenantId });
  const { data: developers = [] } = useTenantDevelopers({ tenantId });
  const { data: projects = [] } = useTenantProjects({ tenantId });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<CopilotAttachmentPayload[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastRecommendation, setLastRecommendation] = useState<CopilotRecommendation | null>(null);
  const [references, setReferences] = useState<Array<{ title: string; url: string }>>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    isSupported: isSpeechSupported,
    isRecording,
    interimTranscript,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech,
  } = useSpeechCapture({
    onResult: ({ transcript, isFinal }) => {
      if (!transcript) {
        return;
      }
      if (isFinal) {
        setInputValue((prev) => {
          if (!prev.trim()) {
            return transcript.trim();
          }
          return `${prev.trim()} ${transcript.trim()}`.trim();
        });
      }
    },
    onError: (message) => {
      setError((prev) => prev ?? message);
    },
  });

  useEffect(() => {
    document.title = 'S.T.E.V.E • BountyAI';
    return () => {
      document.title = 'BountyAI';
    };
  }, []);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Reset conversation when project changes
  useEffect(() => {
    setMessages([]);
    setLastRecommendation(null);
    setReferences([]);
    setError(null);
  }, [selectedProjectId]);

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId), [projects, selectedProjectId]);

  const missionContext = useMemo(() => {
    if (!selectedProject) {
      return undefined;
    }
    const requiredSkills = selectedProject.required_skills?.length
      ? selectedProject.required_skills
      : selectedProject.skillsRequired ?? [];
    
    const candidateTeams = teams
      .map((team) => {
        const teamSkills = Array.isArray(team.skills) ? team.skills : [];
        const skillMatch = requiredSkills.length === 0
          ? 0
          : teamSkills.filter((skill) => requiredSkills.includes(skill)).length / requiredSkills.length;
        
        // Get team members
        const teamMembers = developers
          .filter((dev) => dev.primaryTeamId === team.id)
          .map((dev) => ({
            id: dev.id,
            name: dev.displayName,
            skills: Array.isArray(dev.skills) ? dev.skills : [],
            availability: dev.availability?.hoursPerWeek ?? 0,
          }));
        
        return {
          teamId: team.id,
          teamName: team.name,
          skills: teamSkills,
          skillMatch,
          availableCapacity: Math.max(0, (team.maxCapacity ?? 0) - (team.currentWorkload ?? 0)),
          productivityScore: team.productivityScore ?? team.productivity_rate ?? 0.75,
          members: teamMembers,
        };
      })
      .sort((a, b) => b.skillMatch - a.skillMatch)
      .slice(0, 5);

    return {
      projectId: selectedProject.id,
      projectTitle: selectedProject.title ?? selectedProject.name,
      projectDifficulty: selectedProject.difficulty,
      requiredSkills,
      deadline: selectedProject.deadline ?? null,
      summary: selectedProject.description,
      estimatedHours: selectedProject.estimatedHours ?? selectedProject.estimated_hours,
      candidateTeams,
    };
  }, [selectedProject, teams, developers]);

  function handleVoiceToggle() {
    if (isRecording) {
      stopSpeech();
      return;
    }
    resetSpeech();
    setError(null);
    startSpeech();
  }

  function handleRemoveAttachment(id: string) {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }

  async function readFileAsBase64(file: File): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.split(',')[1] ?? '' : result;
        resolve(base64);
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) {
      return;
    }

    setUploadError(null);

    if (attachments.length >= MAX_TOTAL_ATTACHMENTS) {
      setUploadError(`You can attach up to ${MAX_TOTAL_ATTACHMENTS} files.`);
      event.target.value = '';
      return;
    }

    const availableSlots = MAX_TOTAL_ATTACHMENTS - attachments.length;
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    const newAttachments: CopilotAttachmentPayload[] = [];

    for (const file of selectedFiles) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setUploadError(`"${file.name}" is larger than ${Math.round(MAX_ATTACHMENT_SIZE / (1024 * 1024))} MB.`);
        continue;
      }
      try {
        const data = await readFileAsBase64(file);
        newAttachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          data,
        });
      } catch (fileError) {
        const message = fileError instanceof Error ? fileError.message : 'Failed to process attachment';
        setUploadError(message);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }

    event.target.value = '';
  }

  async function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    const attachmentsToSend = attachments;
    const messageAttachments = attachmentsToSend.map(({ data, ...meta }) => meta);
    const userMessage: CopilotMessage = {
      id: crypto.randomUUID(),
      role: 'manager',
      content: trimmed,
      createdAt: Date.now(),
      status: 'ready',
      attachments: messageAttachments,
    };
    const pendingAssistant: CopilotMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Thinking…',
      createdAt: Date.now(),
      status: 'pending',
    };

    setMessages((prev) => [...prev, userMessage, pendingAssistant]);
    setInputValue('');
    setAttachments([]);
    setIsSending(true);
    setError(null);

    try {
      const context = missionContext;
      
      // Build conversation history from all previous ready messages (exclude initial greeting and insights)
      const conversationHistory = messages
        .filter((msg) => msg.status === 'ready' && !msg.id.startsWith('insight-'))
        .slice(1) // Skip only the initial system greeting
        .map((msg) => ({
          role: msg.role === 'manager' ? ('user' as const) : ('assistant' as const),
          content: msg.content,
        }));
      
      // Add current user message
      conversationHistory.push({ role: 'user' as const, content: trimmed });
      
      const response = await sendCopilotMessage({
        messages: conversationHistory,
        missionContext: context,
        attachments: attachmentsToSend,
      });

      setMessages((prev) =>
        prev.map((message) =>
          message.id === pendingAssistant.id
            ? {
                ...message,
                content: response.reply,
                status: 'ready',
              }
            : message,
        ),
      );

      // Don't add insights as messages - they pollute conversation history
      // Instead, we'll display them separately in the UI
      // const insights = response.insights ?? [];

      console.log('=== AI COPILOT DEBUG ===');
      console.log('Mission Context Sent:', context);
      console.log('Candidate Teams:', context?.candidateTeams);
      console.log('AI Response:', response);
      console.log('Recommendation:', response.recommendation);
      console.log('========================');
      
      setLastRecommendation(response.recommendation ?? null);
      setReferences(response.references ?? []);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Unable to reach the copilot service.';
      setError(message);
      setMessages((prev) =>
        prev.map((entry) =>
          entry.id === pendingAssistant.id
            ? {
                ...entry,
                content: message,
                status: 'error',
              }
            : entry,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!isSending) {
        void handleSend();
      }
    }
  }

  async function handleAssignTeam() {
    if (!lastRecommendation?.teamId || !selectedProjectId) {
      const message = !lastRecommendation?.teamId 
        ? 'No team ID in recommendation. Please ask the AI to recommend a specific team.'
        : 'No project selected';
      setError(message);
      console.error('=== ASSIGNMENT ERROR ===');
      console.error('lastRecommendation:', lastRecommendation);
      console.error('selectedProjectId:', selectedProjectId);
      console.error('========================');
      return;
    }

    console.log('=== ASSIGNING TEAM ===');
    console.log('Project ID:', selectedProjectId);
    console.log('Team ID:', lastRecommendation.teamId);
    console.log('Team Name:', lastRecommendation.teamName);
    console.log('API URL:', `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/assign_project`);
    console.log('======================');

    setIsAssigning(true);
    setError(null);

    try {
      const result = await assignProjectToTeam({
        projectId: selectedProjectId,
        teamId: lastRecommendation.teamId,
        reasoning: lastRecommendation.summary,
      });

      console.log('=== ASSIGNMENT SUCCESS ===');
      console.log('Result:', result);
      console.log('==========================');

      const selectedProject = projects.find(p => p.id === selectedProjectId);

      // Store assignment data in sessionStorage for the assignment view
      const assignmentData = {
        assignmentId: result.assignmentId,
        projectId: result.projectId,
        projectTitle: selectedProject?.title || selectedProject?.name || 'Project',
        teamId: result.teamId,
        teamName: result.teamName,
        tasks: result.tasks,
        reasoning: lastRecommendation.summary,
      };
      
      sessionStorage.setItem(`assignment_${result.assignmentId}`, JSON.stringify(assignmentData));

      // Navigate to assignment view
      navigate(`/manager/assignment/${result.assignmentId}`);

    } catch (assignError) {
      const message = assignError instanceof Error ? assignError.message : 'Failed to assign project';
      setError(message);
      console.error('=== ASSIGNMENT FAILED ===');
      console.error('Error:', assignError);
      console.error('Error message:', message);
      if (assignError instanceof Error && 'response' in assignError) {
        console.error('Response:', (assignError as any).response);
      }
      console.error('=========================');
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <GlassCard className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Messages Area */}
        <div ref={scrollContainerRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold text-foreground">S.T.E.V.E</h1>
                <p className="text-sm text-foreground/60 uppercase tracking-[0.3em]">
                  Simplified Task Enforcement Virtual Environment
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[80%] rounded-3xl px-5 py-3 text-sm shadow-sm transition-colors',
                  message.role === 'manager'
                    ? 'ml-auto bg-foreground text-background'
                    : message.status === 'error'
                      ? 'bg-red-100 text-red-900'
                      : 'bg-white/85 text-foreground',
                )}
              >
                <div className="text-xs uppercase tracking-[0.25em] text-foreground/40">
                  {message.role === 'manager' ? 'Manager' : 'S.T.E.V.E'}
                  {message.status === 'pending' ? ' • Thinking' : ''}
                </div>
                <p className="mt-2 whitespace-pre-line leading-relaxed">{message.content}</p>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.attachments.map((file) => (
                      <span
                        key={file.id}
                        className="rounded-full border border-foreground/10 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-foreground/60"
                      >
                        {file.name} · {formatFileSize(file.size)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer with Input */}
        <footer className="mt-4 space-y-3 border-t border-white/40 pt-4">
            {error && (
              <div className="rounded-2xl border border-red-300 bg-red-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-red-800">
                {error}
              </div>
            )}

            {uploadError && (
              <div className="rounded-2xl border border-neon-orange/40 bg-neon-orange/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-orange">
                {uploadError}
              </div>
            )}

            {speechError && !error && (
              <div className="rounded-2xl border border-neon-purple/40 bg-neon-purple/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-purple">
                {speechError}
              </div>
            )}

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-foreground/60"
                  >
                    <span>{file.name}</span>
                    <span className="text-foreground/40">· {formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(file.id)}
                      className="text-[10px] uppercase tracking-[0.2em] text-foreground/50 transition-colors hover:text-foreground"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {interimTranscript && isRecording && (
              <div className="rounded-2xl border border-neon-teal/30 bg-neon-teal/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-neon-teal">
                Listening: {interimTranscript}
              </div>
            )}

            {lastRecommendation && (
              <div className="rounded-2xl border border-neon-teal/30 bg-neon-teal/10 px-4 py-3 text-sm text-foreground/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-[0.3em] text-neon-teal/80">Preferred Squad</div>
                    <div className="text-base font-semibold text-foreground">{lastRecommendation.teamName}</div>
                    {!lastRecommendation.teamId && (
                      <div className="mt-2 text-xs text-red-600">
                        ⚠️ Warning: Team ID missing. Ask AI to provide specific team recommendation.
                      </div>
                    )}
                    {lastRecommendation.confidence != null && (
                      <div className="mt-1 inline-block rounded-full border border-neon-teal/40 bg-white/60 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-neon-teal">
                        Confidence {(lastRecommendation.confidence * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { void handleAssignTeam(); }}
                    disabled={isAssigning || !lastRecommendation.teamId}
                    className="rounded-2xl border border-neon-teal/40 bg-neon-teal/90 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-background shadow-glow transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAssigning ? 'Assigning…' : 'Assign Team'}
                  </button>
                </div>
                {lastRecommendation.summary && <p className="mt-3 leading-relaxed text-foreground/70">{lastRecommendation.summary}</p>}
              </div>
            )}

            {references.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {references.map((reference) => (
                  <a
                    key={reference.url}
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-foreground/15 bg-white/80 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-foreground/60 transition hover:border-neon-teal/40 hover:text-neon-teal"
                  >
                    {reference.title}
                  </a>
                ))}
              </div>
            )}

            {/* Input Field with Inline Controls */}
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <textarea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message S.T.E.V.E..."
                  className="w-full rounded-3xl border border-black/10 bg-white/90 px-5 py-4 pr-24 text-sm text-foreground focus:border-neon-teal focus:outline-none focus:ring-2 focus:ring-neon-teal/30 resize-none"
                  rows={1}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {/* Voice Input Button */}
                  <button
                    type="button"
                    onClick={handleVoiceToggle}
                    disabled={!isSpeechSupported}
                    className={cn(
                      'rounded-full p-2 transition-colors',
                      isRecording
                        ? 'bg-neon-teal/90 text-background'
                        : 'text-foreground/50 hover:text-foreground/80 hover:bg-white/50',
                      !isSpeechSupported && 'cursor-not-allowed opacity-40'
                    )}
                    title={isRecording ? 'Stop recording' : 'Start voice input'}
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSending) {
                        void handleSend();
                      }
                    }}
                    disabled={isSending || inputValue.trim().length === 0}
                    className={cn(
                      'rounded-full p-2 transition-colors',
                      inputValue.trim().length > 0 && !isSending
                        ? 'bg-neon-teal/90 text-background hover:bg-neon-teal'
                        : 'text-foreground/30 cursor-not-allowed'
                    )}
                    title="Send message"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Attach Files Button */}
              <label className="cursor-pointer rounded-full p-3 text-foreground/50 transition-colors hover:bg-white/50 hover:text-foreground/80">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <input type="file" className="hidden" multiple onChange={handleAttachmentChange} />
              </label>
            </div>

            {/* Project Selector - Minimal */}
            {projects.length > 1 && (
              <div className="flex items-center justify-center">
                <select
                  value={selectedProjectId ?? ''}
                  onChange={(event) => setSelectedProjectId(event.target.value || null)}
                  className="rounded-full border border-black/5 bg-white/60 px-4 py-1.5 text-xs text-foreground/60 focus:border-neon-teal focus:outline-none focus:ring-1 focus:ring-neon-teal/30"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
        </footer>
      </GlassCard>
    </div>
  );
}
