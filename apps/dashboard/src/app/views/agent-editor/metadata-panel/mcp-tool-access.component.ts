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
  templateUrl: './mcp-tool-access.component.html',
  styleUrl: './mcp-tool-access.component.scss',
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
