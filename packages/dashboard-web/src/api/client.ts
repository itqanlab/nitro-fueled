import type {
  TaskRecord,
  PlanData,
  OrchestratorState,
  FullTaskData,
  ReviewData,
  AntiPatternRule,
  LessonEntry,
  DashboardStats,
  SessionSummary,
  SessionData,
} from '../types/index.js';

const API_BASE = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE ?? '/api';
const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;

class ApiClient {
  private readonly baseUrl: string;

  public constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? API_BASE;
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  public async getRegistry(): Promise<readonly TaskRecord[]> {
    return this.fetchJson<readonly TaskRecord[]>('/registry');
  }

  public async getPlan(): Promise<PlanData | null> {
    const result = await this.fetchJson<PlanData | { error: string }>('/plan');
    return 'error' in result ? null : result;
  }

  public async getState(): Promise<OrchestratorState | null> {
    const result = await this.fetchJson<OrchestratorState | { error: string }>(
      '/state',
    );
    return 'error' in result ? null : result;
  }

  public async getTask(taskId: string): Promise<FullTaskData> {
    if (!TASK_ID_RE.test(taskId)) throw new Error(`Invalid taskId: ${taskId}`);
    return this.fetchJson<FullTaskData>(`/tasks/${taskId}`);
  }

  public async getTaskReviews(taskId: string): Promise<readonly ReviewData[]> {
    if (!TASK_ID_RE.test(taskId)) throw new Error(`Invalid taskId: ${taskId}`);
    return this.fetchJson<readonly ReviewData[]>(`/tasks/${taskId}/reviews`);
  }

  public async getAntiPatterns(): Promise<readonly AntiPatternRule[]> {
    return this.fetchJson<readonly AntiPatternRule[]>('/anti-patterns');
  }

  public async getLessons(): Promise<readonly LessonEntry[]> {
    return this.fetchJson<readonly LessonEntry[]>('/review-lessons');
  }

  public async getStats(): Promise<DashboardStats> {
    return this.fetchJson<DashboardStats>('/stats');
  }

  public async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.fetchJson<{ status: string; timestamp: string }>('/health');
  }

  public async getSessions(): Promise<readonly SessionSummary[]> {
    return this.fetchJson<readonly SessionSummary[]>('/sessions');
  }

  public async getActiveSessions(): Promise<readonly SessionSummary[]> {
    return this.fetchJson<readonly SessionSummary[]>('/sessions/active');
  }

  public async getSession(id: string): Promise<SessionData> {
    return this.fetchJson<SessionData>(`/sessions/${encodeURIComponent(id)}`);
  }
}

export const api = new ApiClient();
