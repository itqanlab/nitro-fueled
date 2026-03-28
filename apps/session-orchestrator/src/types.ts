export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface WorkerTokenStats {
  total_input: number;
  total_output: number;
  total_cache_creation: number;
  total_cache_read: number;
  total_combined: number;
  context_current_k: number;
  context_percent: number;
  compaction_count: number;
}

export interface WorkerCost {
  input_usd: number;
  output_usd: number;
  cache_usd: number;
  total_usd: number;
}

export interface WorkerProgress {
  message_count: number;
  tool_calls: number;
  files_read: string[];
  files_written: string[];
  last_action: string;
  last_action_at: number;
  elapsed_minutes: number;
}

export type WorkerStatus = 'running' | 'completed' | 'failed' | 'killed';
export type HealthStatus = 'healthy' | 'starting' | 'high_context' | 'compacting' | 'stuck' | 'finished';

export type LauncherMode = 'iterm' | 'print' | 'opencode';
export type Provider = 'claude' | 'glm' | 'opencode';

export interface Worker {
  worker_id: string;
  label: string;
  pid: number;
  session_id: string;
  jsonl_path: string;
  working_directory: string;
  model: string;
  provider: Provider;
  status: WorkerStatus;
  started_at: number;
  tokens: WorkerTokenStats;
  cost: WorkerCost;
  progress: WorkerProgress;
  iterm_session_id: string;
  auto_close: boolean;
  launcher: LauncherMode;
  log_path?: string;
}

export interface JsonlAssistantMessage {
  type: 'assistant';
  message: {
    model: string;
    content: JsonlContentBlock[];
    usage: TokenUsage;
    stop_reason: string | null;
  };
  timestamp: string;
}

export interface JsonlUserMessage {
  type: 'user';
  message: {
    content: JsonlContentBlock[];
  };
  timestamp: string;
}

export interface JsonlSystemMessage {
  type: 'system';
  timestamp: string;
}

export interface JsonlProgressMessage {
  type: 'progress';
  timestamp?: string;
}

export type JsonlMessage = JsonlAssistantMessage | JsonlUserMessage | JsonlSystemMessage | JsonlProgressMessage | { type: string };

export interface JsonlContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface SessionMeta {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
}

// --- Event-driven worker completion ---

export interface FileValueCondition {
  type: 'file_value';
  path: string;
  value: string;
  event_label: string;
}

export interface FileContainsCondition {
  type: 'file_contains';
  path: string;
  contains: string;
  event_label: string;
}

export interface FileExistsCondition {
  type: 'file_exists';
  path: string;
  event_label: string;
}

export type WatchCondition = FileValueCondition | FileContainsCondition | FileExistsCondition;

export interface WatchEvent {
  worker_id: string;
  event_label: string;
  triggered_at: string; // ISO timestamp
  condition: WatchCondition;
}
