export type SessionViewerPhase = 'PM' | 'Architect' | 'Team-Leader' | 'Dev' | 'Review';

export type SessionViewerStatus = 'running' | 'completed' | 'failed';

export interface SessionViewerHeader {
  readonly sessionId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly startedAt: string;
  readonly currentPhase: SessionViewerPhase;
  readonly status: SessionViewerStatus;
}

interface SessionViewerMessageBase {
  readonly id: string;
  readonly timestamp: string;
}

export interface SessionViewerAssistantMessage extends SessionViewerMessageBase {
  readonly kind: 'assistant';
  readonly markdown: string;
}

export interface SessionViewerToolCallMessage extends SessionViewerMessageBase {
  readonly kind: 'tool-call';
  readonly toolName: string;
  readonly params: string;
}

export interface SessionViewerToolResultMessage extends SessionViewerMessageBase {
  readonly kind: 'tool-result';
  readonly toolName: string;
  readonly result: string;
}

export interface SessionViewerStatusMessage extends SessionViewerMessageBase {
  readonly kind: 'status';
  readonly phase: SessionViewerPhase;
  readonly status: SessionViewerStatus;
  readonly label: string;
  readonly detail: string;
}

export type SessionViewerMessage =
  | SessionViewerAssistantMessage
  | SessionViewerToolCallMessage
  | SessionViewerToolResultMessage
  | SessionViewerStatusMessage;

export interface SessionViewerStep {
  readonly delayMs: number;
  readonly phase: SessionViewerPhase;
  readonly status: SessionViewerStatus;
  readonly message: SessionViewerMessage;
}
