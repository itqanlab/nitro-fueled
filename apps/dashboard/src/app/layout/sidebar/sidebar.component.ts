import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { SidebarSection, SidebarItem } from '../../models/sidebar.model';

const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    title: 'Library',
    type: 'library',
    items: [
      { label: 'Agents', icon: '\u{1F9D1}', route: '/agents' },
      { label: 'Skills', icon: '\u26A1', route: '/agents' },
      { label: 'Commands', icon: '\u25B6', route: '/agents' },
      { label: 'Prompts', icon: '\u{1F4DD}', route: '/agents' },
      { label: 'Workflows', icon: '\u{1F504}', route: '/agents' },
      { label: 'Orchestration', icon: '\u{1F517}', route: '/orchestration' },
    ],
  },
  {
    title: 'Management',
    type: 'management',
    items: [
      { label: 'Analytics', icon: '\u{1F4CA}', route: '/analytics' },
      { label: 'Model Performance', icon: '\u{1F916}', route: '/analytics/model-performance' },
      { label: 'Progress Center', icon: '\u{1F6F0}', route: '/progress' },
      { label: 'Sessions', icon: '\u{1F4C5}', route: '/sessions' },
      { label: 'Reports', icon: '\u{1F4C8}', route: '/reports' },
      { label: 'Logs', icon: '\u{1F4DC}', route: '/logs' },
      { label: 'Integrations', icon: '\u{1F517}', route: '/mcp' },
    ],
  },
  {
    title: 'Telemetry',
    type: 'management',
    items: [
      { label: 'Model Performance', icon: '\u{1F4CA}', route: '/telemetry/model-performance' },
      { label: 'Phase Timing',       icon: '\u23F1',    route: '/telemetry/phase-timing' },
      { label: 'Session Comparison', icon: '\u21C4',    route: '/telemetry/session-comparison' },
      { label: 'Task Trace',         icon: '\u{1F50D}', route: '/telemetry/task-trace' },
    ],
  },
  {
    title: 'Providers',
    type: 'provider',
    items: [
      { label: 'Provider Hub', icon: '\u{1F916}', route: '/providers' },
    ],
  },
  {
    title: '',
    type: 'settings',
    items: [
      { label: 'Settings', icon: '\u2699', route: '/settings' },
    ],
  },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgClass, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly api = inject(ApiService);

  private readonly stats = toSignal(
    this.api.getStats().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  public readonly sections = computed<readonly SidebarSection[]>(() => {
    const stats = this.stats();
    const inProgress =
      (stats?.byStatus?.['IN_PROGRESS'] ?? 0) +
      (stats?.byStatus?.['IN_REVIEW'] ?? 0);
    const activeWorkers = stats?.activeWorkers ?? 0;

    return SIDEBAR_SECTIONS.map((section) => ({
      ...section,
      items: section.items.map((item): SidebarItem => {
        if (item.route === '/orchestration' && inProgress > 0) {
          return { ...item, badge: inProgress };
        }
        if (item.route === '/sessions' && activeWorkers > 0) {
          return { ...item, badge: activeWorkers };
        }
        return item;
      }),
    }));
  });

  public trackByLabel(_index: number, item: SidebarItem): string {
    return item.label;
  }

  public trackByTitle(_index: number, section: SidebarSection): string {
    return section.title;
  }
}
