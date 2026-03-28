import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { PlaceholderViewComponent } from './views/placeholder-view.component';
import { DashboardComponent } from './views/dashboard/dashboard.component';

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'analytics', component: PlaceholderViewComponent, data: { title: 'Analytics' } },
      { path: 'agents', component: PlaceholderViewComponent, data: { title: 'Agents' } },
      { path: 'mcp', component: PlaceholderViewComponent, data: { title: 'MCP Integrations' } },
      { path: 'models', component: PlaceholderViewComponent, data: { title: 'Models' } },
      { path: 'new-task', component: PlaceholderViewComponent, data: { title: 'New Task' } },
      { path: 'onboarding', component: PlaceholderViewComponent, data: { title: 'Onboarding' } },
      { path: 'providers', component: PlaceholderViewComponent, data: { title: 'Provider Hub' } },
    ],
  },
];
