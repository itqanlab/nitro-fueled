import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

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
  SessionData,
  AnalyticsCostData,
  AnalyticsEfficiencyData,
  AnalyticsModelsData,
  AnalyticsSessionsData,
} from '../../../../dashboard-api/src/dashboard/dashboard.types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api`;

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
    return this.http.get<FullTaskData>(`${this.base}/tasks/${encodeURIComponent(id)}`);
  }

  public getTaskReviews(id: string): Observable<ReviewData[]> {
    return this.http.get<ReviewData[]>(`${this.base}/tasks/${encodeURIComponent(id)}/reviews`);
  }

  public getTaskPipeline(id: string): Observable<PipelineData> {
    return this.http.get<PipelineData>(`${this.base}/tasks/${encodeURIComponent(id)}/pipeline`);
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

  public getSessions(): Observable<SessionSummary[]> {
    return this.http.get<SessionSummary[]>(`${this.base}/sessions`);
  }

  public getSession(id: string): Observable<SessionData> {
    return this.http.get<SessionData>(`${this.base}/sessions/${encodeURIComponent(id)}`);
  }

  public getAnalyticsCost(): Observable<AnalyticsCostData> {
    return this.http.get<AnalyticsCostData>(`${this.base}/analytics/cost`);
  }

  public getAnalyticsEfficiency(): Observable<AnalyticsEfficiencyData> {
    return this.http.get<AnalyticsEfficiencyData>(`${this.base}/analytics/efficiency`);
  }

  public getAnalyticsModels(): Observable<AnalyticsModelsData> {
    return this.http.get<AnalyticsModelsData>(`${this.base}/analytics/models`);
  }

  public getAnalyticsSessions(): Observable<AnalyticsSessionsData> {
    return this.http.get<AnalyticsSessionsData>(`${this.base}/analytics/sessions`);
  }
}
