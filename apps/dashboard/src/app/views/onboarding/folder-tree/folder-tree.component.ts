import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FolderNode } from '../../../models/onboarding.model';

@Component({
  selector: 'app-folder-tree',
  standalone: true,
  template: `
    <div class="folder-tree">
      <div class="folder-tree-title">{{ title() }}</div>
      @for (node of nodes(); track node.name) {
        <div
          class="folder-tree-node"
          [class.dir]="node.type === 'dir'"
          [class.file]="node.type === 'file'"
          [class.moved]="node.color === 'moved'"
          [class.new]="node.color === 'new'"
          [style.padding-left.px]="node.indent * 16"
        >
          @if (node.type === 'dir') {
            <span class="icon">📁</span>
          } @else {
            <span class="icon">📄</span>
          }
          {{ node.name }}
        </div>
      }
    </div>
  `,
  styles: [`
    .folder-tree {
      padding: 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      line-height: 1.8;
      color: var(--text-secondary);
    }

    .folder-tree-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .icon { margin-right: 4px; }
    .dir { color: var(--accent); }
    .file { color: var(--text-tertiary); }
    .moved { color: var(--warning); }
    .new { color: var(--success); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderTreeComponent {
  public readonly title = input.required<string>();
  public readonly nodes = input.required<readonly FolderNode[]>();
}
