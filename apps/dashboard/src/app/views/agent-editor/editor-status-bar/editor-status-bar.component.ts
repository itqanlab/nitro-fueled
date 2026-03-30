import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { AgentEditorStore } from '../agent-editor.store';

@Component({
  selector: 'app-editor-status-bar',
  standalone: true,
  imports: [],
  templateUrl: './editor-status-bar.component.html',
  styleUrl: './editor-status-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorStatusBarComponent {
  protected readonly store = inject(AgentEditorStore);

  protected onSaveDraft(): void {
    this.store.saveDraft();
  }

  protected onSaveVersion(): void {
    this.store.saveVersion();
  }
}
