import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}

@Component({
  selector: 'app-tab-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <nav class="tab-nav">
      @for (tab of validatedTabs; track tab.id) {
        <button
          class="tab-button"
          [ngClass]="{ 'active': activeTab === tab.id }"
          (click)="tabChange.emit(tab.id)">
          @if (tab.icon) {
            <span class="tab-icon">{{ tab.icon }}</span>
          }
          <span class="tab-label">{{ tab.label }}</span>
          @if (tab.count !== undefined && tab.count > 0) {
            <span class="tab-count">{{ tab.count }}</span>
          }
        </button>
      }
    </nav>
  `,
  styles: [`
    .tab-nav {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--border);
    }
    .tab-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
    }
    .tab-button:hover {
      color: var(--text-primary);
    }
    .tab-button.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    .tab-icon {
      font-size: 14px;
    }
    .tab-label {
      font-weight: 500;
    }
    .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: var(--accent-bg);
      color: var(--accent);
      border-radius: 9px;
      font-size: 11px;
      font-weight: 600;
    }
  `],
})
export class TabNavComponent {
  private _tabs: TabItem[] = [];
  private _activeTab = '';

  @Input({ required: true }) set tabs(val: TabItem[]) {
    this._tabs = Array.isArray(val) ? this.validateTabs(val) : [];
  }

  get tabs(): TabItem[] {
    return this._tabs;
  }

  get validatedTabs(): TabItem[] {
    return this._tabs.filter(tab => this.isValidTab(tab));
  }

  @Input({ required: true }) set activeTab(val: string) {
    this._activeTab = this.isValidTabId(val) ? val : this.getDefaultTabId();
  }

  get activeTab(): string {
    return this._activeTab;
  }

  @Output() tabChange = new EventEmitter<string>();

  private validateTabs(tabs: TabItem[]): TabItem[] {
    return tabs
      .filter(tab => this.isValidTab(tab))
      .map(tab => ({
        ...tab,
        id: String(tab.id || '').trim() || this.generateFallbackId(),
        label: String(tab.label || '').trim() || 'Tab',
        count: typeof tab.count === 'number' && tab.count > 0 ? tab.count : undefined
      }));
  }

  private isValidTab(tab: any): tab is TabItem {
    return tab && 
           typeof tab === 'object' &&
           typeof tab.id === 'string' && tab.id.trim().length > 0 &&
           typeof tab.label === 'string' && tab.label.trim().length > 0;
  }

  private isValidTabId(tabId: any): boolean {
    return typeof tabId === 'string' && 
           this._tabs.some(tab => tab.id === tabId);
  }

  private getDefaultTabId(): string {
    return this._tabs.length > 0 ? this._tabs[0].id : '';
  }

  private generateFallbackId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
