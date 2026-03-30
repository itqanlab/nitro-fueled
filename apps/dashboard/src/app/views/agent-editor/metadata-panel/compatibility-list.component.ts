import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AgentEditorStore } from '../agent-editor.store';
import { CompatibilityEntry } from '../../../models/agent-editor.model';

@Component({
  selector: 'app-compatibility-list',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './compatibility-list.component.html',
  styleUrl: './compatibility-list.component.scss',
})
export class CompatibilityListComponent {
  protected readonly store = inject(AgentEditorStore);

  protected readonly compatibility = computed<readonly CompatibilityEntry[]>(
    () => this.store.selectedAgent()?.compatibility ?? [],
  );
}
