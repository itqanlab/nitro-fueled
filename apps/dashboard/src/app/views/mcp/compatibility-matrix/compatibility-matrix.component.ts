import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { McpServer, McpToolAccessRow } from '../../../models/mcp.model';

@Component({
  selector: 'app-compatibility-matrix',
  standalone: true,
  templateUrl: './compatibility-matrix.component.html',
  styleUrl: './compatibility-matrix.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompatibilityMatrixComponent {
  readonly servers    = input.required<readonly McpServer[]>();
  readonly toolAccess = input.required<readonly McpToolAccessRow[]>();
}
