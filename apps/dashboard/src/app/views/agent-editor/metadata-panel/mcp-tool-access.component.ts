import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AgentEditorStore } from '../agent-editor.store';
import { McpToolAccess } from '../../../models/agent-editor.model';

@Component({
  selector: 'app-mcp-tool-access',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mcp-section">
      <div class="mcp-section-label">MCP Tool Access</div>
      <ul class="mcp-tool-list" role="list" aria-label="MCP tools">
        @for (tool of tools(); track tool.name) {
          <li
            class="mcp-tool-row"
            (click)="toggleTool(tool.name)"
            (keydown.enter)="toggleTool(tool.name)"
            (keydown.space)="toggleTool(tool.name)"
            role="checkbox"
            [attr.aria-checked]="tool.enabled"
            [attr.aria-label]="tool.name + ' access ' + (tool.enabled ? 'enabled' : 'disabled')"
            tabindex="0"
          >
            <span class="mcp-tool-name">{{ tool.name }}</span>
            <span
              class="mcp-tool-status"
              [class.enabled]="tool.enabled"
              [class.disabled]="!tool.enabled"
              aria-hidden="true"
            >
              {{ tool.enabled ? '✓' : '×' }}
            </span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .mcp-section { margin-top: 16px; }

    .mcp-section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-tertiary);
      margin-bottom: 8px;
    }

    .mcp-tool-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .mcp-tool-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: var(--radius);
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s;
    }

    .mcp-tool-row:hover { background-color: var(--bg-tertiary); }

    .mcp-tool-row:focus-visible {
      outline: 2px solid var(--border-focus);
      outline-offset: -2px;
    }

    .mcp-tool-name {
      font-size: 13px;
      color: var(--text-primary);
    }

    .mcp-tool-status {
      font-size: 14px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .mcp-tool-status.enabled { color: var(--success); }
    .mcp-tool-status.disabled { color: var(--text-tertiary); }
  `],
})
export class McpToolAccessComponent {
  protected readonly store = inject(AgentEditorStore);

  protected readonly tools = computed<readonly McpToolAccess[]>(
    () => this.store.metadata().mcpTools,
  );

  protected toggleTool(name: string): void {
    const current = this.store.metadata().mcpTools;
    const updated = current.map((tool) =>
      tool.name === name ? { ...tool, enabled: !tool.enabled } : tool,
    );
    this.store.updateMetadataField('mcpTools', updated);
  }
}
