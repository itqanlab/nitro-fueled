import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { StatusBarComponent } from './status-bar/status-bar.component';
import { CommandConsoleComponent } from '../components/command-console/command-console.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, StatusBarComponent, CommandConsoleComponent],
  template: `
    <div class="shell">
      <app-header />
      <div class="shell-body">
        <app-sidebar />
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
      <app-status-bar />
      <app-command-console />
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .shell-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      background: var(--bg-primary);
    }
  `],
})
export class LayoutComponent {}
