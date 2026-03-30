import type {
  SessionViewerAssistantMessage,
  SessionViewerPhase,
  SessionViewerStatus,
  SessionViewerStatusMessage,
  SessionViewerStep,
  SessionViewerToolCallMessage,
  SessionViewerToolResultMessage,
} from '../models/session-viewer.model';

export const DEFAULT_TASK_ID = 'TASK_2026_157';
export const DEFAULT_TASK_TITLE = 'Session Viewer — Live Log Streaming';
export const SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

export type SessionViewerDraftMessage =
  | Omit<SessionViewerAssistantMessage, 'timestamp'>
  | Omit<SessionViewerToolCallMessage, 'timestamp'>
  | Omit<SessionViewerToolResultMessage, 'timestamp'>
  | Omit<SessionViewerStatusMessage, 'timestamp'>;

export type SessionViewerDraftStep = Omit<SessionViewerStep, 'message'> & {
  readonly message: SessionViewerDraftMessage;
};

export const SESSION_VIEWER_SCRIPT: readonly SessionViewerDraftStep[] = [
  {
    delayMs: 200,
    phase: 'PM',
    status: 'running',
    message: {
      id: 'status-pm',
      kind: 'status',
      phase: 'PM',
      status: 'running',
      label: 'PM started',
      detail: 'Clarifying scope for the live session viewer and validating acceptance criteria.',
    },
  },
  {
    delayMs: 1700,
    phase: 'PM',
    status: 'running',
    message: {
      id: 'assistant-pm',
      kind: 'assistant',
      markdown:
        'Reading `task.md` and existing dashboard routes to define the **session viewer** surface before implementation.',
    },
  },
  {
    delayMs: 1200,
    phase: 'Architect',
    status: 'running',
    message: {
      id: 'tool-read',
      kind: 'tool-call',
      toolName: 'Read',
      params: '{\n  "filePath": "apps/dashboard/src/app/app.routes.ts"\n}',
    },
  },
  {
    delayMs: 900,
    phase: 'Architect',
    status: 'running',
    message: {
      id: 'tool-read-result',
      kind: 'tool-result',
      toolName: 'Read',
      result: 'Confirmed the dashboard uses lazy-loaded standalone routes and an existing `/session/:id` navigation source.',
    },
  },
  {
    delayMs: 1300,
    phase: 'Architect',
    status: 'running',
    message: {
      id: 'status-architect',
      kind: 'status',
      phase: 'Architect',
      status: 'running',
      label: 'Architecture ready',
      detail: 'Plan uses a typed mock event stream plus a standalone Angular viewer component.',
    },
  },
  {
    delayMs: 1500,
    phase: 'Dev',
    status: 'running',
    message: {
      id: 'assistant-dev',
      kind: 'assistant',
      markdown:
        'Implementing a **mock WebSocket-like stream** with assistant messages, tool activity, and phase transitions. Markdown output will be sanitized before rendering.',
    },
  },
  {
    delayMs: 1000,
    phase: 'Dev',
    status: 'running',
    message: {
      id: 'tool-patch',
      kind: 'tool-call',
      toolName: 'apply_patch',
      params: '{\n  "files": [\n    "session-viewer.component.ts",\n    "session-viewer.component.html",\n    "session-viewer.component.scss"\n  ]\n}',
    },
  },
  {
    delayMs: 1100,
    phase: 'Dev',
    status: 'running',
    message: {
      id: 'tool-patch-result',
      kind: 'tool-result',
      toolName: 'apply_patch',
      result: 'Created the new route, typed models, mock stream service, and chat-style viewer layout.',
    },
  },
  {
    delayMs: 1500,
    phase: 'Review',
    status: 'running',
    message: {
      id: 'status-review',
      kind: 'status',
      phase: 'Review',
      status: 'running',
      label: 'Verification running',
      detail: 'Building the dashboard to catch template, routing, and typing issues before handoff.',
    },
  },
  {
    delayMs: 1600,
    phase: 'Review',
    status: 'completed',
    message: {
      id: 'assistant-complete',
      kind: 'assistant',
      markdown:
        'Build passed. The session viewer now shows **live mock activity**, collapsible tool payloads, and auto-scroll that resumes when you jump back to the bottom.',
    },
  },
  {
    delayMs: 800,
    phase: 'Review',
    status: 'completed',
    message: {
      id: 'status-complete',
      kind: 'status',
      phase: 'Review',
      status: 'completed',
      label: 'Session complete',
      detail: 'Handoff prepared for review worker consumption.',
    },
  },
];

export function deriveHeaderPhase(linkedPhase: string | null, linkedStatus: string): SessionViewerPhase {
  if (linkedStatus === 'IN_PROGRESS' && linkedPhase === 'Architect') {
    return 'Architect';
  }

  if (linkedStatus === 'IN_PROGRESS' && linkedPhase === 'Dev') {
    return 'Dev';
  }

  return 'PM';
}

export function buildTimestampedScript(startedAtIso: string): readonly SessionViewerStep[] {
  const startedAt = new Date(startedAtIso);

  return SESSION_VIEWER_SCRIPT.map((step, index) => ({
    ...step,
    message: {
      ...step.message,
      timestamp: new Date(startedAt.getTime() + (index + 1) * 90_000).toISOString(),
    },
  }));
}

export function buildStartedAtFromSession(sessionId: string): string {
  const stamp = sessionId.replace('SESSION_', '').replace('_', 'T');
  return `${stamp}.000Z`;
}
