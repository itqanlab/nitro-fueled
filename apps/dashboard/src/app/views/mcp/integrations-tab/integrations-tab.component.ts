import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { McpIntegration } from '../../../models/mcp.model';

@Component({
  selector: 'app-integrations-tab',
  standalone: true,
  imports: [NgClass],
  templateUrl: './integrations-tab.component.html',
  styleUrl: './integrations-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationsTabComponent {
  readonly integrations = input.required<readonly McpIntegration[]>();
}
