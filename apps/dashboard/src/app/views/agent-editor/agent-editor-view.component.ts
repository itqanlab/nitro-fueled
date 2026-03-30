import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { AgentEditorStore } from './agent-editor.store';
import { AgentListSidebarComponent } from './agent-list-sidebar/agent-list-sidebar.component';
import { MetadataPanelComponent } from './metadata-panel/metadata-panel.component';
import { EditorPanelComponent } from './editor-panel/editor-panel.component';
import { EditorStatusBarComponent } from './editor-status-bar/editor-status-bar.component';

@Component({
  selector: 'app-agent-editor-view',
  standalone: true,
  imports: [
    AgentListSidebarComponent,
    MetadataPanelComponent,
    EditorPanelComponent,
    EditorStatusBarComponent,
  ],
  templateUrl: './agent-editor-view.component.html',
  styleUrl: './agent-editor-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentEditorViewComponent {
  protected readonly store = inject(AgentEditorStore);
}
