import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { DashboardComponent } from './views/dashboard/dashboard.component';
import { McpIntegrationsComponent } from './views/mcp/mcp-integrations.component';
import { AnalyticsComponent } from './views/analytics/analytics.component';
import { AgentEditorViewComponent } from './views/agent-editor/agent-editor-view.component';
import { ProviderHubComponent } from './views/providers/provider-hub.component';

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'analytics', component: AnalyticsComponent },
      {
        path: 'progress',
        loadComponent: () =>
          import('./views/progress-center/progress-center.component').then(
            (m) => m.ProgressCenterComponent,
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./views/reports/reports.component').then(
            (m) => m.ReportsComponent,
          ),
      },
      { path: 'agents', component: AgentEditorViewComponent },
      { path: 'mcp', component: McpIntegrationsComponent },
      {
        path: 'orchestration',
        loadComponent: () =>
          import('./views/orchestration/orchestration.component').then(
            (m) => m.OrchestrationComponent,
          ),
      },
      {
        path: 'models',
        loadComponent: () =>
          import('./views/models/model-assignments.component').then(
            (m) => m.ModelAssignmentsComponent,
          ),
      },
      {
        path: 'new-task',
        loadComponent: () =>
          import('./views/new-task/new-task.component').then(
            (m) => m.NewTaskComponent,
          ),
      },
      {
        path: 'onboarding',
        loadComponent: () =>
          import('./views/onboarding/onboarding.component').then(
            (m) => m.OnboardingComponent,
          ),
      },
      { path: 'providers', component: ProviderHubComponent },
      {
        path: 'analytics/model-performance',
        loadComponent: () =>
          import('./views/analytics/model-performance/model-perf-analytics.component').then(
            (m) => m.ModelPerfAnalyticsComponent,
          ),
      },
      {
        path: 'telemetry/model-performance',
        loadComponent: () =>
          import('./views/model-performance/model-performance.component').then(
            (m) => m.ModelPerformanceComponent,
          ),
      },
      {
        path: 'telemetry/phase-timing',
        loadComponent: () =>
          import('./views/phase-timing/phase-timing.component').then(
            (m) => m.PhaseTimingComponent,
          ),
      },
      {
        path: 'telemetry/session-comparison',
        loadComponent: () =>
          import('./views/session-comparison/session-comparison.component').then(
            (m) => m.SessionComparisonComponent,
          ),
      },
      {
        path: 'telemetry/task-trace',
        loadComponent: () =>
          import('./views/task-trace/task-trace.component').then(
            (m) => m.TaskTraceComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./views/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
      {
        path: 'project',
        loadComponent: () =>
          import('./views/project/project.component').then(
            (m) => m.ProjectComponent,
          ),
      },
      {
        path: 'project/task/:taskId',
        loadComponent: () =>
          import('./views/task-detail/task-detail.component').then(
            (m) => m.TaskDetailComponent,
          ),
      },
      {
        path: 'sessions',
        loadComponent: () =>
          import('./views/sessions/sessions-list/sessions-list.component').then(
            (m) => m.SessionsListComponent,
          ),
      },
      {
        path: 'sessions/:id',
        loadComponent: () =>
          import('./views/sessions/session-detail/session-detail.component').then(
            (m) => m.SessionDetailComponent,
          ),
      },
      {
        path: 'logs',
        loadComponent: () =>
          import('./views/logs/logs.component').then(
            (m) => m.LogsComponent,
          ),
      },
    ],
  },
];
