import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { filter } from 'rxjs';
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
const MAX_TRANSCRIPT_ENTRIES = 200;

@Component({
  selector: 'app-command-console',
  standalone: true,
  imports: [FormsModule, NgClass, DatePipe],
  templateUrl: './command-console.component.html',
  styleUrl: './command-console.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandConsoleComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('commandInput');
  private readonly transcriptEl = viewChild<ElementRef<HTMLDivElement>>('transcriptContainer');

  public readonly isOpen = signal(false);
  public readonly inputText = signal('');
  public readonly isExecuting = signal(false);
  public readonly catalog = signal<readonly CommandCatalogEntry[]>([]);
  public readonly suggestions = signal<readonly CommandSuggestion[]>([]);
  public readonly transcript = signal<readonly TranscriptEntry[]>([]);
  public readonly historyIndex = signal(-1);
  public readonly showAutocomplete = signal(false);
  public readonly activeAutocompleteIndex = signal(0);
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
  private readonly routeContext = signal(this.getRouteContext(this.router.url));
  private entryCounter = 0;

  public constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.routeContext.set(this.getRouteContext(event.urlAfterRedirects));
        if (this.isOpen()) {
          this.refreshSuggestions();
        }
      });

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
    if (this.isExecuting()) return;

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
        const message = this.getErrorMessage(err);
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
    const filtered = this.filteredCommands();
    if (this.showAutocomplete() && filtered.length > 0) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.moveAutocomplete(-1);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.moveAutocomplete(1);
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.selectAutocomplete(filtered[this.activeAutocompleteIndex()] ?? filtered[0]);
        return;
      }
    }

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
      if (filtered.length === 1) {
        this.inputText.set(filtered[0].slashCommand + ' ');
        this.showAutocomplete.set(false);
      } else if (filtered.length > 1) {
        this.selectAutocomplete(filtered[this.activeAutocompleteIndex()] ?? filtered[0]);
      }
    }
  }

  public onInputChange(): void {
    const text = this.inputText();
    const shouldShow = text.startsWith('/') && text.length >= 2;
    this.showAutocomplete.set(shouldShow);
    if (shouldShow) {
      this.activeAutocompleteIndex.set(0);
    }
  }

  public selectAutocomplete(entry: CommandCatalogEntry): void {
    this.inputText.set(entry.slashCommand + ' ');
    this.showAutocomplete.set(false);
    this.activeAutocompleteIndex.set(0);
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
    this.transcript.update((items) => [...items, entry].slice(-MAX_TRANSCRIPT_ENTRIES));
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
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
      // storage full or unavailable
    }
  }

  private loadHistory(): string[] {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private refreshSuggestions(): void {
    this.api.getCommandSuggestions(this.routeContext()).subscribe({
      next: (suggestions) => this.suggestions.set(suggestions),
      error: () => this.suggestions.set([]),
    });
  }

  private moveAutocomplete(direction: -1 | 1): void {
    const filtered = this.filteredCommands();
    if (filtered.length === 0) return;

    let nextIndex = this.activeAutocompleteIndex() + direction;
    if (nextIndex < 0) nextIndex = filtered.length - 1;
    if (nextIndex >= filtered.length) nextIndex = 0;
    this.activeAutocompleteIndex.set(nextIndex);
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const message = typeof err.error === 'string'
        ? err.error
        : typeof err.error?.message === 'string'
          ? err.error.message
          : err.message;
      return message || 'Command execution failed';
    }

    if (err instanceof Error) {
      return err.message;
    }

    return 'Command execution failed';
  }

  private getRouteContext(url: string): { route: string; taskId?: string } {
    const pathname = url.split('?')[0] || '/';
    const taskMatch = pathname.match(/^\/project\/task\/(TASK_\d{4}_\d{3})$/);

    if (taskMatch) {
      return { route: '/tasks/', taskId: taskMatch[1] };
    }

    if (pathname === '/project') {
      return { route: '/tasks' };
    }

    if (pathname.startsWith('/session/')) {
      return { route: '/sessions' };
    }

    if (pathname === '/analytics' || pathname.startsWith('/telemetry/')) {
      return { route: '/analytics' };
    }

    if (pathname === '/dashboard') {
      return { route: '/' };
    }

    return { route: pathname || '/' };
  }
}
