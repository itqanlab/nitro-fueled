import { Component, Input } from '@angular/core';
import { McpServer, McpToolAccessRow } from '../../../models/mcp.model';

@Component({
  selector: 'app-compatibility-matrix',
  standalone: true,
  templateUrl: './compatibility-matrix.component.html',
  styleUrl: './compatibility-matrix.component.scss',
})
export class CompatibilityMatrixComponent {
  @Input({ required: true }) servers!: readonly McpServer[];
  @Input({ required: true }) toolAccess!: readonly McpToolAccessRow[];
}
