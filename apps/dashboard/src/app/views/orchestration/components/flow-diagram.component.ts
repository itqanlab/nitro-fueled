import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import type { OrchestrationFlowPhase } from '../../../models/api.types';

@Component({
  selector: 'app-flow-diagram',
  standalone: true,
  imports: [NgClass],
  template: '',
  styles: [':host { display: none; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowDiagramComponent {
  @Input() public flow: OrchestrationFlowPhase[] = [];
}
