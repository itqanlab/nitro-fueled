import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MOCK_PROJECTS } from '../../services/mock-data.constants';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-workspace-switcher',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ws-rail">
      <div class="ws-logo" title="Nitro-Fueled">
        <span>⚡</span>
      </div>

      <div class="ws-divider"></div>

      <div class="ws-list">
        @for (project of projects; track project.id) {
          <div
            class="ws-item"
            [ngClass]="{ active: activeProjectId() === project.id }"
            [title]="project.name"
            (click)="selectProject(project)">
            <div class="ws-avatar" [style.background]="getColor(project.id)">
              {{ getInitials(project.name) }}
            </div>
            <div class="ws-status-dot" [ngClass]="project.status"></div>
          </div>
        }

        <div class="ws-add" title="Add workspace" (click)="addProject()">
          <span>+</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ws-rail {
      width: 62px;
      min-width: 62px;
      background: #111111;
      border-right: 1px solid #222;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 0;
      gap: 4px;
      overflow: hidden;
    }

    .ws-logo {
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      border-radius: 10px;
      background: #1e3a5f;
      cursor: default;
      margin-bottom: 4px;
    }

    .ws-divider {
      width: 32px;
      height: 1px;
      background: #2a2a2a;
      margin: 4px 0;
    }

    .ws-list {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex: 1;
    }

    .ws-item {
      position: relative;
      cursor: pointer;
      border-radius: 10px;
      transition: all 0.15s;

      &::before {
        content: '';
        position: absolute;
        left: -10px;
        top: 50%;
        transform: translateY(-50%) scaleY(0);
        width: 3px;
        height: 16px;
        border-radius: 0 3px 3px 0;
        background: var(--accent, #177ddc);
        transition: transform 0.15s, height 0.15s;
      }

      &:hover::before {
        transform: translateY(-50%) scaleY(1);
        height: 10px;
      }

      &.active::before {
        transform: translateY(-50%) scaleY(1);
        height: 20px;
      }

      &:hover .ws-avatar {
        border-radius: 12px;
        filter: brightness(1.15);
      }

      &.active .ws-avatar {
        border-radius: 12px;
        box-shadow: 0 0 0 2px var(--accent, #177ddc);
      }
    }

    .ws-avatar {
      width: 38px;
      height: 38px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      transition: border-radius 0.15s, filter 0.15s;
      letter-spacing: 0.5px;
    }

    .ws-status-dot {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid #111;

      &.active { background: var(--status-success, #49aa19); }
      &.inactive { background: #444; }
      &.has-updates { background: var(--status-warning, #d89614); }
    }

    .ws-add {
      width: 38px;
      height: 38px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      color: #444;
      cursor: pointer;
      border: 1.5px dashed #2a2a2a;
      line-height: 1;
      transition: all 0.15s;
      margin-top: 2px;

      &:hover {
        border-color: var(--accent, #177ddc);
        color: var(--accent, #177ddc);
        background: #111d2c;
        border-radius: 12px;
      }
    }
  `],
})
export class WorkspaceSwitcherComponent {
  public readonly projects: readonly Project[] = MOCK_PROJECTS;
  public readonly activeProjectId = signal<string>(MOCK_PROJECTS[0]?.id ?? '');

  private readonly PROJECT_COLORS: readonly string[] = [
    '#2a5298', '#1a6b4a', '#6b2a52', '#4a4a2a',
    '#2a4a6b', '#6b4a1a', '#3d1a6b', '#1a5c6b',
  ];

  constructor(private readonly router: Router) {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const match = e.urlAfterRedirects.match(/\/project\/?([\w-]+)?/);
        if (match?.[1]) {
          this.activeProjectId.set(match[1]);
        }
      });
  }

  public getInitials(name: string): string {
    return name
      .split(/[-_ ]+/)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  public getColor(id: string): string {
    const index = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return this.PROJECT_COLORS[index % this.PROJECT_COLORS.length];
  }

  public selectProject(project: Project): void {
    this.activeProjectId.set(project.id);
    this.router.navigate(['/project']);
  }

  public addProject(): void {
    // placeholder for future project creation flow
  }
}
