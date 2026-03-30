import { Component } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NzIconModule],
  template: `
    <div class="shell-header">
      <div class="shell-header-left">
        <div class="app-logo">N</div>
        <span class="app-title">N.Gine</span>
      </div>
      <div class="shell-header-right">
        <button class="header-btn" title="Search">
          <nz-icon nzType="search" nzTheme="outline" />
        </button>
        <button class="header-btn" title="Notifications">
          <nz-icon nzType="bell" nzTheme="outline" />
        </button>
        <button class="header-btn" title="Settings">
          <nz-icon nzType="setting" nzTheme="outline" />
        </button>
      </div>
    </div>
  `,
  styles: [`
    .shell-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 48px;
      padding: 0 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid #303030;
    }
    .shell-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .app-logo {
      width: 24px;
      height: 24px;
      background: var(--accent);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      color: #fff;
    }
    .app-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .shell-header-right {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .header-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
    }
    .header-btn:hover {
      background: #303030;
      color: var(--text-primary);
    }
  `],
})
export class HeaderComponent {}
