import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { PlaceholderViewComponent } from './views/placeholder-view.component';
import { DashboardComponent } from './views/dashboard/dashboard.component';
import { McpIntegrationsComponent } from './views/mcp/mcp-integrations.component';
import { AnalyticsComponent } from './views/analytics/analytics.component';
import { AgentEditorViewComponent } from './views/agent-editor/agent-editor-view.component';

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
      { path: 'models', component: PlaceholderViewComponent, data: { title: 'Models' } },
      { path: 'new-task', component: PlaceholderViewComponent, data: { title: 'New Task' } },
      { path: 'onboarding', component: PlaceholderViewComponent, data: { title: 'Onboarding' } },
      { path: 'providers', component: PlaceholderViewComponent, data: { title: 'Provider Hub' } },
    ],
  },
];
