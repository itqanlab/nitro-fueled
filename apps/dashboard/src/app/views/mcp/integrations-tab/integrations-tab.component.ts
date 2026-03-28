import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { McpIntegration } from '../../../models/mcp.model';

@Component({
  selector: 'app-integrations-tab',
  standalone: true,
  imports: [NgClass],
  templateUrl: './integrations-tab.component.html',
  styleUrl: './integrations-tab.component.scss',
})
export class IntegrationsTabComponent {
  @Input({ required: true }) integrations!: readonly McpIntegration[];
}
