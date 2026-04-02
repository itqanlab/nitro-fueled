import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const badgeSource = readRepoFile('apps/dashboard/src/app/shared/badge/badge.component.ts');
const statusIndicatorSource = readRepoFile(
  'apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts',
);
const emptyStateSource = readRepoFile('apps/dashboard/src/app/shared/empty-state/empty-state.component.ts');
const analyticsComponentSource = readRepoFile(
  'apps/dashboard/src/app/views/analytics/analytics.component.ts',
);
const analyticsTemplateSource = readRepoFile(
  'apps/dashboard/src/app/views/analytics/analytics.component.html',
);
const dashboardComponentSource = readRepoFile(
  'apps/dashboard/src/app/views/dashboard/dashboard.component.ts',
);
const dashboardTemplateSource = readRepoFile(
  'apps/dashboard/src/app/views/dashboard/dashboard.component.html',
);

describe('TASK_2026_160 shared component contracts', () => {
  it('keeps all new shared components standalone', () => {
    expect(badgeSource).toContain('standalone: true');
    expect(statusIndicatorSource).toContain('standalone: true');
    expect(emptyStateSource).toContain('standalone: true');
  });

  it('marks all new shared components as OnPush', () => {
    expect(badgeSource).toContain('ChangeDetectionStrategy.OnPush');
    expect(statusIndicatorSource).toContain('ChangeDetectionStrategy.OnPush');
    expect(emptyStateSource).toContain('ChangeDetectionStrategy.OnPush');
  });

  it('uses NgClass-driven badge variants and size classes', () => {
    expect(badgeSource).toContain('imports: [NgClass]');
    expect(badgeSource).toContain("[ngClass]=\"[variant, 'badge-' + size]\"");
    expect(badgeSource).toContain("@Input() variant: BadgeVariant = 'neutral';");
    expect(badgeSource).toContain("@Input() size: BadgeSize = 'md';");
  });

  it('renders accessible status indicators with running pulse behavior', () => {
    expect(statusIndicatorSource).toContain('[attr.aria-label]="status"');
    expect(statusIndicatorSource).toContain("pulse && status === 'running' ? 'dot-pulse' : ''");
    expect(statusIndicatorSource).toContain("@Input() pulse = true;");
    expect(statusIndicatorSource).toContain("@Input() size: StatusSize = 'md';");
  });

  it('uses Angular control flow for optional empty-state actions', () => {
    expect(emptyStateSource).toContain('@if (actionLabel)');
    expect(emptyStateSource).toContain('(click)="actionEvent.emit()"');
    expect(emptyStateSource).toContain("@Input() actionLabel = '';");
    expect(emptyStateSource).toContain('@Output() actionEvent = new EventEmitter<void>();');
  });
});

describe('TASK_2026_160 analytics integration', () => {
  it('imports the shared badge and status indicator into the analytics view', () => {
    expect(analyticsComponentSource).toContain(
      "import { BadgeComponent } from '../../shared/badge/badge.component';",
    );
    expect(analyticsComponentSource).toContain(
      "import { StatusIndicatorComponent } from '../../shared/status-indicator/status-indicator.component';",
    );
    expect(analyticsComponentSource).toContain(
      'imports: [NgClass, DecimalPipe, BadgeComponent, StatusIndicatorComponent]',
    );
  });

  it('renders agent rows with the shared status indicator and badge components', () => {
    expect(analyticsTemplateSource).toContain('<app-status-indicator');
    expect(analyticsTemplateSource).toContain("[status]=\"agent.online ? 'completed' : 'offline'\"");
    expect(analyticsTemplateSource).toContain('<app-badge');
    expect(analyticsTemplateSource).toContain("[label]=\"agent.successRate + '%'\"");
    expect(analyticsTemplateSource).toContain(
      "[variant]=\"agent.successRate >= 90 ? 'success' : agent.successRate >= 80 ? 'warning' : 'error'\"",
    );
  });
});

describe('TASK_2026_160 dashboard integration', () => {
  it('imports the shared empty state and status indicator into the dashboard view', () => {
    expect(dashboardComponentSource).toContain(
      "import { StatusIndicatorComponent } from '../../shared/status-indicator/status-indicator.component';",
    );
    expect(dashboardComponentSource).toContain(
      "import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';",
    );
    expect(dashboardComponentSource).toContain(
      'imports: [StatCardComponent, StatusIndicatorComponent, EmptyStateComponent]',
    );
  });

  it('renders shared empty states and status indicators in dashboard sections', () => {
    expect(dashboardTemplateSource).toContain('<app-empty-state icon="&#x23F3;" message="No active sessions"></app-empty-state>');
    expect(dashboardTemplateSource).toContain('<app-empty-state icon="&#x2611;" message="No active tasks"></app-empty-state>');
    expect(dashboardTemplateSource).toContain('<app-status-indicator');
    expect(dashboardTemplateSource).toContain("[status]=\"session.status === 'running' ? 'running' : 'paused'\"");
  });
});
