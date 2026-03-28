import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '../../../models/onboarding.model';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPanelComponent {
  public readonly messages = input.required<readonly ChatMessage[]>();
  public readonly messageSent = output<string>();

  public inputValue = '';

  public send(): void {
    const text = this.inputValue.trim();
    if (!text) return;
    this.messageSent.emit(text);
    this.inputValue = '';
  }

  public onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}
