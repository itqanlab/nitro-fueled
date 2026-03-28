import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { PlaceholderViewComponent } from './views/placeholder-view.component';
import { DashboardComponent } from './views/dashboard/dashboard.component';
import { McpIntegrationsComponent } from './views/mcp/mcp-integrations.component';
import { AnalyticsComponent } from './views/analytics/analytics.component';
import { AgentEditorViewComponent } from './views/agent-editor/agent-editor-view.component';
import { ModelAssignmentsComponent } from './views/models/model-assignments.component';
import { NewTaskComponent } from './views/new-task/new-task.component';
import { OnboardingComponent } from './views/onboarding/onboarding.component';
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
      { path: 'models', component: ModelAssignmentsComponent },
      { path: 'new-task', component: NewTaskComponent },
      { path: 'onboarding', component: OnboardingComponent },
      { path: 'providers', component: ProviderHubComponent },
    ],
  },
];
