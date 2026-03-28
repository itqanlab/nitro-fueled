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
      { path: 'agents', component: AgentEditorViewComponent },
      { path: 'mcp', component: McpIntegrationsComponent },
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
    ],
  },
];
