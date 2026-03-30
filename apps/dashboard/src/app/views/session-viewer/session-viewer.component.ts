import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { SessionMockService } from '../../services/session-mock.service';
import type {
  SessionViewerHeader,
  SessionViewerMessage,
  SessionViewerStatus,
} from '../../models/session-viewer.model';

type SessionViewerDisplayMessage = SessionViewerMessage & { readonly html?: string };

@Component({
  selector: 'app-session-viewer',
  standalone: true,
  imports: [DatePipe, NgClass, RouterLink],
  templateUrl: './session-viewer.component.html',
  styleUrl: './session-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionViewerComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sessionMock = inject(SessionMockService);
  private readonly streamViewport = viewChild<ElementRef<HTMLDivElement>>('streamViewport');
  private readonly sessionIdSignal = toSignal(
    this.route.paramMap.pipe(map(params => params.get('sessionId') ?? '')),
    { initialValue: '' },
  );

  public readonly messages = signal<readonly SessionViewerMessage[]>([]);
  public readonly autoScrollEnabled = signal(true);
  public readonly now = signal(Date.now());
  public readonly sessionId = computed(() => this.sessionIdSignal().trim());
  public readonly isValidSession = computed(() => this.sessionMock.isValidSessionId(this.sessionId()));
  public readonly header = signal<SessionViewerHeader | null>(null);
  public readonly statusClassMap: Record<SessionViewerStatus, string> = {
    running: 'status-pill--running',
    completed: 'status-pill--completed',
    failed: 'status-pill--failed',
  };
  public readonly durationLabel = computed(() => {
    const header = this.header();
    if (!header) return '0m';
    const durationMs = Math.max(0, this.now() - new Date(header.startedAt).getTime());
    const totalMinutes = Math.floor(durationMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  });
  public readonly displayMessages = computed<readonly SessionViewerDisplayMessage[]>(() =>
    this.messages().map(message =>
      message.kind === 'assistant'
        ? { ...message, html: this.renderMarkdown(message.markdown) }
        : message,
    ),
  );

  public constructor() {
    effect((onCleanup) => {
      const sessionId = this.sessionId();
      if (!this.sessionMock.isValidSessionId(sessionId)) {
        this.header.set(null);
        this.messages.set([]);
        return;
      }

      const initialHeader = this.sessionMock.createHeader(sessionId);
      this.header.set(initialHeader);
      this.messages.set([]);
      this.now.set(Date.now());

      const subscription = this.sessionMock.streamSession(initialHeader.sessionId).subscribe(step => {
        this.messages.update(messages => [...messages, step.message]);
        this.header.update(header =>
          header
            ? { ...header, currentPhase: step.phase, status: step.status }
            : header,
        );
        this.scheduleScrollToBottom();
      });

      const timer = window.setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => {
        subscription.unsubscribe();
        window.clearInterval(timer);
      });
    });
  }

  public onStreamScroll(): void {
    const viewport = this.streamViewport()?.nativeElement;
    if (!viewport) return;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    this.autoScrollEnabled.set(distanceFromBottom <= 32);
  }

  public jumpToLive(): void {
    this.autoScrollEnabled.set(true);
    this.scheduleScrollToBottom();
  }

  private renderMarkdown(markdown: string): string {
    try {
      const raw = marked.parse(markdown, { async: false });
      return DOMPurify.sanitize(typeof raw === 'string' ? raw : markdown);
    } catch {
      return DOMPurify.sanitize(markdown);
    }
  }

  private scheduleScrollToBottom(): void {
    if (!this.autoScrollEnabled()) return;
    requestAnimationFrame(() => {
      const viewport = this.streamViewport()?.nativeElement;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
  }
}
