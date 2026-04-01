import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type { ApiKeyEntry, LauncherEntry, ModelMapping, SubscriptionEntry } from '../models/settings.model';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

import type { ProgressCenterSnapshot } from '../models/progress-center.model';

import type {
  TaskRecord,
  FullTaskData,
  PlanData,
  OrchestratorState,
  ReviewData,
  PipelineData,
  AntiPatternRule,
  LessonEntry,
  DashboardStats,
  GraphData,
  WorkerTree,
  SessionSummary,
  AnalyticsCostData,
  AnalyticsEfficiencyData,
  AnalyticsModelsData,
  AnalyticsSessionsData,
  CortexTask,
  CortexTaskContext,
  CortexTaskTrace,
  CortexSession,
  CortexSessionSummary,
  CortexWorker,
  CortexModelPerformance,
  CortexPhaseTiming,
  CortexEvent,
  OrchestrationFlow,
  CreateTaskRequest,
  CreateTaskResponse,
  LogsEventFilters,
  WorkerLogEntry,
  SessionLogSummary,
  LogSearchResult,
  CommandCatalogEntry,
  CommandSuggestion,
  CommandExecuteRequest,
  CommandExecuteResult,
  ProviderQuotaItem,
  CustomFlow,
  CreateCustomFlowRequest,
  UpdateCustomFlowRequest,
  CustomFlowPhase,
  CreateSessionRequest,
  CreateSessionResponse,
  ListSessionsResponse,
  SessionStatusResponse,
  SessionActionResponse,
  UpdateSessionConfigRequest,
  UpdateSessionConfigResponse,
  AnalyticsModelPerfResponse,
  AnalyticsLauncherMetricsResponse,
  AnalyticsRoutingRecommendationsResponse,
  SessionHistoryListItem,
  SessionHistoryDetail,
} from '../models/api.types';
import type { ReportsOverview } from '../models/reports.model';

// ── Allowlists for filter parameters ─────────────────────────────────────────
const VALID_TASK_STATUSES = [
  'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW', 'FIXING',
  'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
] as const;

const VALID_TASK_TYPES = [
  'FEATURE', 'BUGFIX', 'REFACTORING', 'DOCUMENTATION',
  'RESEARCH', 'DEVOPS', 'CREATIVE', 'CONTENT',
] as const;

const VALID_COMPLEXITIES = ['Simple', 'Medium', 'Complex'] as const;

const VALID_WORKER_STATUSES = [
  'pending', 'running', 'complete', 'failed', 'cancelled',
] as const;

type TaskStatus = typeof VALID_TASK_STATUSES[number];
type TaskType = typeof VALID_TASK_TYPES[number];
type Complexity = typeof VALID_COMPLEXITIES[number];
type WorkerStatus = typeof VALID_WORKER_STATUSES[number];

function isValidTaskStatus(v: string): v is TaskStatus {
  return (VALID_TASK_STATUSES as readonly string[]).includes(v);
}
function isValidTaskType(v: string): v is TaskType {
  return (VALID_TASK_TYPES as readonly string[]).includes(v);
}
function isValidComplexity(v: string): v is Complexity {
  return (VALID_COMPLEXITIES as readonly string[]).includes(v);
}
function isValidWorkerStatus(v: string): v is WorkerStatus {
  return (VALID_WORKER_STATUSES as readonly string[]).includes(v);
}
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api`;
  private readonly cortexBase = `${environment.apiUrl}/api`;

  public getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.base}/health`);
  }

  public getRegistry(): Observable<TaskRecord[]> {
    return this.http.get<TaskRecord[]>(`${this.base}/registry`);
  }

  public getPlan(): Observable<PlanData | { error: string }> {
    return this.http.get<PlanData | { error: string }>(`${this.base}/plan`);
  }

  public getState(): Observable<OrchestratorState | { error: string }> {
    return this.http.get<OrchestratorState | { error: string }>(`${this.base}/state`);
  }

  public getTask(id: string): Observable<FullTaskData> {
    return this.http.get<FullTaskData>(
      `${this.base}/tasks/${encodeURIComponent(id)}`,
    );
  }

  public getTaskReviews(id: string): Observable<ReviewData[]> {
    return this.http.get<ReviewData[]>(
      `${this.base}/tasks/${encodeURIComponent(id)}/reviews`,
    );
  }

  public getTaskPipeline(id: string): Observable<PipelineData> {
    return this.http.get<PipelineData>(
      `${this.base}/tasks/${encodeURIComponent(id)}/pipeline`,
    );
  }

  public getAntiPatterns(): Observable<AntiPatternRule[]> {
    return this.http.get<AntiPatternRule[]>(`${this.base}/anti-patterns`);
  }

  public getLessons(): Observable<LessonEntry[]> {
    return this.http.get<LessonEntry[]>(`${this.base}/review-lessons`);
  }

  public getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base}/stats`);
  }

  public getGraph(): Observable<GraphData> {
    return this.http.get<GraphData>(`${this.base}/graph`);
  }

  public getWorkerTree(): Observable<WorkerTree> {
    return this.http.get<WorkerTree>(`${this.base}/workers/tree`);
  }

  public getActiveSessions(): Observable<SessionSummary[]> {
    return this.http.get<SessionSummary[]>(`${this.base}/sessions/active`);
  }

  public getProgressCenter(): Observable<ProgressCenterSnapshot> {
    return this.http.get<ProgressCenterSnapshot>(`${this.base}/progress-center`);
  }

  public closeStaleSession(ttlMinutes?: number): Observable<{ closed_sessions: number }> {
    let httpParams = new HttpParams();
    if (ttlMinutes !== undefined) {
      httpParams = httpParams.set('ttl', String(ttlMinutes));
    }
    return this.http.post<{ closed_sessions: number }>(
      `${this.base}/sessions/close-stale`,
      null,
      { params: httpParams },
    );
  }

  public getAnalyticsCost(): Observable<AnalyticsCostData> {
    return this.http.get<AnalyticsCostData>(`${this.base}/analytics/cost`);
  }

  public getAnalyticsEfficiency(): Observable<AnalyticsEfficiencyData> {
    return this.http.get<AnalyticsEfficiencyData>(
      `${this.base}/analytics/efficiency`,
    );
  }

  public getAnalyticsModels(): Observable<AnalyticsModelsData> {
    return this.http.get<AnalyticsModelsData>(`${this.base}/analytics/models`);
  }

  public getAnalyticsSessions(): Observable<AnalyticsSessionsData> {
    return this.http.get<AnalyticsSessionsData>(
      `${this.base}/analytics/sessions`,
    );
  }

  public getReportsOverview(params?: { from?: string; to?: string }): Observable<ReportsOverview> {
    let httpParams = new HttpParams();
    if (params?.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params?.to) {
      httpParams = httpParams.set('to', params.to);
    }
    return this.http.get<ReportsOverview>(`${this.base}/reports/overview`, {
      params: httpParams,
    });
  }

  public getCortexTasks(
    params?: { status?: string; type?: string },
  ): Observable<CortexTask[]> {
    let httpParams = new HttpParams();
    if (params?.status !== undefined && isValidTaskStatus(params.status)) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.type !== undefined && isValidTaskType(params.type)) {
      httpParams = httpParams.set('type', params.type);
    }
    return this.http.get<CortexTask[]>(
      `${this.cortexBase}/cortex/tasks`,
      { params: httpParams },
    );
  }

  public getCortexTaskContext(taskId: string): Observable<CortexTaskContext> {
    return this.http.get<CortexTaskContext>(
      `${this.cortexBase}/cortex/tasks/${encodeURIComponent(taskId)}`,
    );
  }

  public updateCortexTask(
    taskId: string,
    fields: { model?: string | null; preferred_provider?: string | null; worker_mode?: string | null },
  ): Observable<{ taskId: string; updated: boolean }> {
    return this.http.patch<{ taskId: string; updated: boolean }>(
      `${this.cortexBase}/cortex/tasks/${encodeURIComponent(taskId)}`,
      fields,
    );
  }

  public getCortexTaskTrace(taskId: string): Observable<CortexTaskTrace> {
    return this.http.get<CortexTaskTrace>(
      `${this.cortexBase}/cortex/tasks/${encodeURIComponent(taskId)}/trace`,
    );
  }

  public getCortexSessions(limit?: number): Observable<CortexSession[]> {
    let httpParams = new HttpParams();
    if (limit !== undefined) {
      httpParams = httpParams.set('limit', String(limit));
    }
    return this.http.get<CortexSession[]>(
      `${this.cortexBase}/cortex/sessions`,
      { params: httpParams },
    );
  }

  public getCortexSessionSummaries(): Observable<CortexSessionSummary[]> {
    return this.http.get<CortexSessionSummary[]>(
      `${this.cortexBase}/cortex/sessions/summaries`,
    );
  }

  public getCortexWorkers(
    params?: { status?: string; limit?: number },
  ): Observable<CortexWorker[]> {
    let httpParams = new HttpParams();
    if (params?.status !== undefined && isValidWorkerStatus(params.status)) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<CortexWorker[]>(
      `${this.cortexBase}/cortex/workers`,
      { params: httpParams },
    );
  }

  public getCortexModelPerformance(
    params?: { taskType?: string; complexity?: string },
  ): Observable<CortexModelPerformance[]> {
    let httpParams = new HttpParams();
    if (params?.taskType !== undefined && isValidTaskType(params.taskType)) {
      httpParams = httpParams.set('taskType', params.taskType);
    }
    if (params?.complexity !== undefined && isValidComplexity(params.complexity)) {
      httpParams = httpParams.set('complexity', params.complexity);
    }
    return this.http.get<CortexModelPerformance[]>(
      `${this.cortexBase}/cortex/analytics/model-performance`,
      { params: httpParams },
    );
  }

  public getCortexPhaseTimings(): Observable<CortexPhaseTiming[]> {
    return this.http.get<CortexPhaseTiming[]>(
      `${this.cortexBase}/cortex/analytics/phase-timing`,
    );
  }

  public getOrchestrationFlows(): Observable<OrchestrationFlow[]> {
    return this.http.get<OrchestrationFlow[]>(`${this.base}/orchestration/flows`);
  }

  public cloneOrchestrationFlow(
    sourceFlowId: string,
    customName: string,
  ): Observable<{ success: boolean; flow: OrchestrationFlow }> {
    return this.http.post<{ success: boolean; flow: OrchestrationFlow }>(
      `${this.base}/orchestration/flows/clone`,
      { sourceFlowId, customName },
    );
  }

  public createTask(req: CreateTaskRequest): Observable<CreateTaskResponse> {
    return this.http.post<CreateTaskResponse>(`${this.base}/tasks/create`, req);
  }

  // ── Logs ────────────────────────────────────────────────────────────────────

  public getLogEvents(filters?: LogsEventFilters): Observable<CortexEvent[]> {
    let params = new HttpParams();
    if (filters?.sessionId) params = params.set('sessionId', filters.sessionId);
    if (filters?.taskId) params = params.set('taskId', filters.taskId);
    if (filters?.eventType) params = params.set('eventType', filters.eventType);
    if (filters?.severity) params = params.set('severity', filters.severity);
    if (filters?.limit !== undefined) params = params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) params = params.set('offset', String(filters.offset));
    return this.http.get<CortexEvent[]>(`${this.base}/logs/events`, { params });
  }

  public getWorkerLogs(workerId: string): Observable<WorkerLogEntry> {
    return this.http.get<WorkerLogEntry>(`${this.base}/logs/workers/${encodeURIComponent(workerId)}`);
  }

  public getSessionLogs(sessionId: string): Observable<SessionLogSummary> {
    return this.http.get<SessionLogSummary>(`${this.base}/logs/sessions/${encodeURIComponent(sessionId)}`);
  }

  public searchLogs(query: string, extra?: { sessionId?: string; taskId?: string; startTime?: string; endTime?: string; limit?: number; offset?: number }): Observable<LogSearchResult> {
    let params = new HttpParams().set('q', query);
    if (extra?.sessionId) params = params.set('sessionId', extra.sessionId);
    if (extra?.taskId) params = params.set('taskId', extra.taskId);
    if (extra?.startTime) params = params.set('startTime', extra.startTime);
    if (extra?.endTime) params = params.set('endTime', extra.endTime);
    if (extra?.limit !== undefined) params = params.set('limit', String(extra.limit));
    if (extra?.offset !== undefined) params = params.set('offset', String(extra.offset));
    return this.http.get<LogSearchResult>(`${this.base}/logs/search`, { params });
  }

  // ── Analytics Module (TASK_2026_216) ─────────────────────────────────────

  public getAnalyticsModelPerformance(params?: { taskType?: string }): Observable<AnalyticsModelPerfResponse> {
    let httpParams = new HttpParams();
    if (params?.taskType !== undefined && isValidTaskType(params.taskType)) {
      httpParams = httpParams.set('taskType', params.taskType);
    }
    return this.http.get<AnalyticsModelPerfResponse>(
      `${this.base}/analytics/model-performance`,
      { params: httpParams },
    );
  }

  public getAnalyticsModelPerformanceById(modelId: string): Observable<AnalyticsModelPerfResponse> {
    return this.http.get<AnalyticsModelPerfResponse>(
      `${this.base}/analytics/model-performance/${encodeURIComponent(modelId)}`,
    );
  }

  public getAnalyticsLaunchers(): Observable<AnalyticsLauncherMetricsResponse> {
    return this.http.get<AnalyticsLauncherMetricsResponse>(
      `${this.base}/analytics/launchers`,
    );
  }

  public getAnalyticsRoutingRecommendations(): Observable<AnalyticsRoutingRecommendationsResponse> {
    return this.http.get<AnalyticsRoutingRecommendationsResponse>(
      `${this.base}/analytics/routing-recommendations`,
    );
  }

  // ── Command Console ──────────────────────────────────────────────────────

  public getCommandCatalog(): Observable<CommandCatalogEntry[]> {
    return this.http.get<CommandCatalogEntry[]>(`${this.base}/command-console/catalog`);
  }

  public getCommandSuggestions(params?: { route?: string; taskId?: string }): Observable<CommandSuggestion[]> {
    let httpParams = new HttpParams();
    if (params?.route) httpParams = httpParams.set('route', params.route);
    if (params?.taskId) httpParams = httpParams.set('taskId', params.taskId);
    return this.http.get<CommandSuggestion[]>(`${this.base}/command-console/suggestions`, { params: httpParams });
  }

  public executeCommand(req: CommandExecuteRequest): Observable<CommandExecuteResult> {
    return this.http.post<CommandExecuteResult>(`${this.base}/command-console/execute`, req);
  }

  // ── Provider Quota ────────────────────────────────────────────────────────

  public getProviderQuota(): Observable<ProviderQuotaItem[]> {
    return this.http.get<ProviderQuotaItem[]>(`${this.base}/providers/quota`);
  }

  // ── Auto-Pilot Session Management ─────────────────────────────────────────

  public createAutoSession(req: CreateSessionRequest = {}): Observable<CreateSessionResponse> {
    return this.http.post<CreateSessionResponse>(`${this.base}/sessions`, req);
  }

  public listAutoSessions(): Observable<ListSessionsResponse> {
    return this.http.get<ListSessionsResponse>(`${this.base}/sessions`);
  }

  public getAutoSession(id: string): Observable<SessionStatusResponse> {
    return this.http.get<SessionStatusResponse>(
      `${this.base}/sessions/${encodeURIComponent(id)}`,
    );
  }

  public pauseAutoSession(id: string): Observable<SessionActionResponse> {
    return this.http.post<SessionActionResponse>(
      `${this.base}/sessions/${encodeURIComponent(id)}/pause`,
      null,
    );
  }

  public resumeAutoSession(id: string): Observable<SessionActionResponse> {
    return this.http.post<SessionActionResponse>(
      `${this.base}/sessions/${encodeURIComponent(id)}/resume`,
      null,
    );
  }

  public stopAutoSession(id: string): Observable<SessionActionResponse> {
    return this.http.post<SessionActionResponse>(
      `${this.base}/sessions/${encodeURIComponent(id)}/stop`,
      null,
    );
  }

  public updateAutoSessionConfig(id: string, req: UpdateSessionConfigRequest): Observable<UpdateSessionConfigResponse> {
    return this.http.patch<UpdateSessionConfigResponse>(
      `${this.base}/sessions/${encodeURIComponent(id)}/config`,
      req,
    );
  }

  public getAutoSessions(): Observable<SessionStatusResponse[]> {
    return this.listAutoSessions().pipe(map(r => [...r.sessions]));
  }

  // ── Session History (cortex DB) ───────────────────────────────────────────

  public getSessionHistory(): Observable<SessionHistoryListItem[]> {
    return this.http.get<SessionHistoryListItem[]>(`${this.base}/session-history`);
  }

  public getSessionHistoryDetail(id: string): Observable<SessionHistoryDetail> {
    return this.http.get<SessionHistoryDetail>(`${this.base}/session-history/${encodeURIComponent(id)}`);
  }

  public drainSession(sessionId: string): Observable<SessionActionResponse> {
    return this.http.patch<SessionActionResponse>(
      `${this.base}/sessions/${encodeURIComponent(sessionId)}/stop`,
      {},
    );
  }

  // ── Custom Flows ──────────────────────────────────────────────────────────

  private readonly orchestrationBase = `${this.base}/orchestration`;

  public getCustomFlows(): Observable<CustomFlow[]> {
    return this.http.get<CustomFlow[]>(`${this.orchestrationBase}/custom-flows`);
  }

  public createCustomFlow(dto: CreateCustomFlowRequest): Observable<CustomFlow> {
    return this.http.post<CustomFlow>(`${this.orchestrationBase}/custom-flows`, dto);
  }

  public updateCustomFlow(id: string, dto: UpdateCustomFlowRequest): Observable<CustomFlow> {
    return this.http.put<CustomFlow>(
      `${this.orchestrationBase}/custom-flows/${encodeURIComponent(id)}`,
      dto,
    );
  }

  public deleteCustomFlow(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.orchestrationBase}/custom-flows/${encodeURIComponent(id)}`,
    );
  }

  public updateCustomFlowPhases(id: string, phases: CustomFlowPhase[]): Observable<CustomFlow> {
    return this.http.put<CustomFlow>(
      `${this.orchestrationBase}/custom-flows/${encodeURIComponent(id)}/phases`,
      { phases },
    );
  }

  public setTaskFlowOverride(taskId: string, flowId: string): Observable<void> {
    return this.http.post<void>(
      `${this.orchestrationBase}/tasks/${encodeURIComponent(taskId)}/flow-override`,
      { flowId },
    );
  }

  public clearTaskFlowOverride(taskId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.orchestrationBase}/tasks/${encodeURIComponent(taskId)}/flow-override`,
    );
  }

  // ── MCP ──────────────────────────────────────────────────────────────────

  public getMcpServers(): Observable<McpServerEntry[]> {
    return this.http.get<McpServerEntry[]>(`${environment.apiUrl}/api/mcp/servers`);
  }

  public addMcpServer(req: McpInstallRequest): Observable<McpServerEntry> {
    return this.http.post<McpServerEntry>(`${environment.apiUrl}/api/mcp/servers`, req);
  }

  public removeMcpServer(id: string): Observable<{ id: string; removed: boolean }> {
    return this.http.delete<{ id: string; removed: boolean }>(
      `${environment.apiUrl}/api/mcp/servers/${encodeURIComponent(id)}`,
    );
  }

  public restartMcpServer(id: string): Observable<{ id: string; action: string; note: string }> {
    return this.http.post<{ id: string; action: string; note: string }>(
      `${environment.apiUrl}/api/mcp/servers/${encodeURIComponent(id)}/restart`,
      {},
    );
  }

  public getMcpToolAccess(): Observable<McpToolAccessMatrix> {
    return this.http.get<McpToolAccessMatrix>(`${environment.apiUrl}/api/mcp/tool-access`);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  public getSettingsApiKeys(): Observable<ApiKeyEntry[]> {
    return this.http.get<ApiKeyEntry[]>(`${this.base}/settings/api-keys`);
  }

  public createSettingsApiKey(body: {
    label?: string;
    key: string;
    providerId?: string;
    provider: string;
    detectedModels?: string[];
  }): Observable<ApiKeyEntry> {
    return this.http.post<ApiKeyEntry>(`${this.base}/settings/api-keys`, body);
  }

  public updateSettingsApiKey(id: string, patch: Partial<Omit<ApiKeyEntry, 'id'>>): Observable<ApiKeyEntry> {
    return this.http.patch<ApiKeyEntry>(`${this.base}/settings/api-keys/${encodeURIComponent(id)}`, patch);
  }

  public deleteSettingsApiKey(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/settings/api-keys/${encodeURIComponent(id)}`);
  }

  public setSettingsApiKeyActive(id: string, isActive: boolean): Observable<ApiKeyEntry> {
    return this.http.patch<ApiKeyEntry>(
      `${this.base}/settings/api-keys/${encodeURIComponent(id)}/active`,
      { isActive },
    );
  }

  public getSettingsLaunchers(): Observable<LauncherEntry[]> {
    return this.http.get<LauncherEntry[]>(`${this.base}/settings/launchers`);
  }

  public createSettingsLauncher(body: {
    name: string;
    type: 'cli' | 'ide' | 'desktop';
    path: string;
  }): Observable<LauncherEntry> {
    return this.http.post<LauncherEntry>(`${this.base}/settings/launchers`, body);
  }

  public setSettingsLauncherActive(id: string, isActive: boolean): Observable<LauncherEntry> {
    return this.http.patch<LauncherEntry>(
      `${this.base}/settings/launchers/${encodeURIComponent(id)}/active`,
      { isActive },
    );
  }

  public getSettingsSubscriptions(): Observable<SubscriptionEntry[]> {
    return this.http.get<SubscriptionEntry[]>(`${this.base}/settings/subscriptions`);
  }

  public connectSettingsSubscription(id: string): Observable<SubscriptionEntry> {
    return this.http.post<SubscriptionEntry>(
      `${this.base}/settings/subscriptions/${encodeURIComponent(id)}/connect`,
      null,
    );
  }

  public disconnectSettingsSubscription(id: string): Observable<SubscriptionEntry> {
    return this.http.delete<SubscriptionEntry>(
      `${this.base}/settings/subscriptions/${encodeURIComponent(id)}/disconnect`,
    );
  }

  public getSettingsMappings(): Observable<ModelMapping[]> {
    return this.http.get<ModelMapping[]>(`${this.base}/settings/mapping`);
  }

  public replaceSettingsMappings(mappings: ModelMapping[]): Observable<ModelMapping[]> {
    return this.http.put<ModelMapping[]>(`${this.base}/settings/mapping`, mappings);
  }
}

export interface McpServerEntry {
  readonly id: string;
  readonly name: string;
  readonly command: string;
  readonly args: string[];
  readonly env: Record<string, string>;
  readonly status: 'active' | 'inactive';
  readonly source: 'user' | 'project';
}

export interface McpInstallRequest {
  readonly name: string;
  readonly command: string;
  readonly args?: string[];
  readonly env?: Record<string, string>;
}

export interface McpToolAccessMatrix {
  readonly servers: string[];
  readonly agents: ReadonlyArray<{ agent: string; access: Record<string, boolean> }>;
}
