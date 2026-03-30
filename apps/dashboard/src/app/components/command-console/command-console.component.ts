import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ApiService } from '../../services/api.service';
import type {
  CommandCatalogEntry,
  CommandSuggestion,
  CommandExecuteResult,
} from '../../models/api.types';

export interface TranscriptEntry {
  readonly id: string;
  readonly type: 'input' | 'output' | 'error';
  readonly content: string;
  readonly timestamp: Date;
  readonly html?: string;
}

const HISTORY_KEY = 'nitro-command-console-history';
const MAX_HISTORY = 100;

@Component({
  selector: 'app-command-console',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './command-console.component.html',
  styleUrl: './command-console.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandConsoleComponent {
  private readonly api = inject(ApiService);
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('commandInput');
  private readonly transcriptEl = viewChild<ElementRef<HTMLDivElement>>('transcript');

  public readonly isOpen = signal(false);
  public readonly inputText = signal('');
  public readonly isExecuting = signal(false);
  public readonly catalog = signal<readonly CommandCatalogEntry[]>([]);
  public readonly suggestions = signal<readonly CommandSuggestion[]>([]);
  public readonly transcript = signal<readonly TranscriptEntry[]>([]);
  public readonly historyIndex = signal(-1);
  public readonly showAutocomplete = signal(false);
  public readonly filteredCommands = computed<readonly CommandCatalogEntry[]>(() => {
    const text = this.inputText().trimStart();
    if (!text.startsWith('/') || text.length < 2) return [];
    const query = text.toLowerCase().slice(1);
    return this.catalog().filter((c) =>
      c.name.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query),
    ).slice(0, 8);
  });

  private readonly history = signal<readonly string[]>(this.loadHistory());
  private entryCounter = 0;

  public constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.api.getCommandCatalog().subscribe({
          next: (cat) => this.catalog.set(cat),
          error: () => this.catalog.set([]),
        });
        this.refreshSuggestions();
        setTimeout(() => this.inputEl()?.nativeElement?.focus(), 100);
      }
    });
  }

  public toggleOpen(): void {
    this.isOpen.update((v) => !v);
  }

  public close(): void {
    this.isOpen.set(false);
  }

  public execute(): void {
    const text = this.inputText().trim();
    if (!text) return;

    this.addToTranscript('input', text);
    this.pushHistory(text);
    this.inputText.set('');
    this.showAutocomplete.set(false);
    this.isExecuting.set(true);

    this.api.executeCommand({ command: text }).subscribe({
      next: (result: CommandExecuteResult) => {
        this.isExecuting.set(false);
        this.addToTranscript(result.success ? 'output' : 'error', result.output, result.success ? result.output : undefined);
      },
      error: (err: unknown) => {
        this.isExecuting.set(false);
        const message = err instanceof Error ? err.message : 'Command execution failed';
        this.addToTranscript('error', message);
      },
    });
  }

  public executeSuggestion(suggestion: CommandSuggestion): void {
    this.inputText.set(suggestion.command);
    this.execute();
  }

  public executeQuickAction(action: string): void {
    this.inputText.set(action);
    this.execute();
  }

  public onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.execute();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.navigateHistory(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.navigateHistory(1);
      return;
    }

    if (event.key === 'Escape') {
      if (this.showAutocomplete()) {
        this.showAutocomplete.set(false);
      } else {
        this.close();
      }
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const filtered = this.filteredCommands();
      if (filtered.length === 1) {
        this.inputText.set(filtered[0].slashCommand + ' ');
        this.showAutocomplete.set(false);
      }
    }
  }

  public onInputChange(): void {
    const text = this.inputText();
    this.showAutocomplete.set(text.startsWith('/') && text.length >= 2);
  }

  public selectAutocomplete(entry: CommandCatalogEntry): void {
    this.inputText.set(entry.slashCommand + ' ');
    this.showAutocomplete.set(false);
    this.inputEl()?.nativeElement?.focus();
  }

  private addToTranscript(type: 'input' | 'output' | 'error', content: string, markdown?: string): void {
    const html = markdown ? this.renderMarkdown(markdown) : (type === 'output' ? this.renderMarkdown(content) : undefined);
    const entry: TranscriptEntry = {
      id: `entry-${++this.entryCounter}`,
      type,
      content,
      timestamp: new Date(),
      html,
    };
    this.transcript.update((items) => [...items, entry]);
    this.scrollToBottom();
  }

  private renderMarkdown(text: string): string {
    try {
      const raw = marked.parse(text, { async: false });
      return DOMPurify.sanitize(typeof raw === 'string' ? raw : text);
    } catch {
      return DOMPurify.sanitize(text);
    }
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const el = this.transcriptEl()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private navigateHistory(direction: -1 | 1): void {
    const list = this.history();
    if (list.length === 0) return;

    let idx = this.historyIndex() + direction;
    if (idx < 0) idx = 0;
    if (idx >= list.length) idx = list.length - 1;

    this.historyIndex.set(idx);
    this.inputText.set(list[idx]);
  }

  private pushHistory(text: string): void {
    const list = [...this.history()];
    const filtered = list.filter((h) => h !== text);
    filtered.unshift(text);
    const trimmed = filtered.slice(0, MAX_HISTORY);
    this.history.set(trimmed);
    this.historyIndex.set(-1);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
      // storage full or unavailable
    }
  }

  private loadHistory(): string[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private refreshSuggestions(): void {
    this.api.getCommandSuggestions().subscribe({
      next: (suggestions) => this.suggestions.set(suggestions),
      error: () => this.suggestions.set([]),
    });
  }
}
