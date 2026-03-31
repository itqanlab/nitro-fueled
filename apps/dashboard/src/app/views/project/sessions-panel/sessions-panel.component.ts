import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import type { SessionStatusResponse } from '../../../models/api.types';

@Component({
  selector: 'app-sessions-panel',
  standalone: true,
  imports: [NgClass],
  templateUrl: './sessions-panel.component.html',
  styleUrl: './sessions-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsPanelComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  @Input() sessions: SessionStatusResponse[] = [];
  @Output() pauseSession = new EventEmitter<string>();
  @Output() resumeSession = new EventEmitter<string>();
  @Output() stopSession = new EventEmitter<string>();
  @Output() drainSession = new EventEmitter<string>();

  public readonly now = signal(Date.now());

  public constructor() {
    // Update "last seen X min ago" labels every 30s
    interval(30_000).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.now.set(Date.now()));
  }

  public onSessionClick(session: SessionStatusResponse): void {
    void this.router.navigate(['/session', session.sessionId]);
  }

  public readonly heartbeatStatusMap = computed(() => {
    const nowMs = this.now();
    const map = new Map<string, { label: string; cssClass: string }>();
    for (const session of this.sessions) {
      const hb = session.lastHeartbeat;
      if (!hb) {
        map.set(session.sessionId, { label: 'No heartbeat', cssClass: 'heartbeat-stale' });
        continue;
      }
      const hbMs = new Date(hb).getTime();
      if (Number.isNaN(hbMs)) {
        map.set(session.sessionId, { label: 'No heartbeat', cssClass: 'heartbeat-stale' });
        continue;
      }
      const ageMs = nowMs - hbMs;
      const ageMinutes = Math.floor(ageMs / 60_000);
      if (ageMinutes < 1) {
        map.set(session.sessionId, { label: 'just now', cssClass: '' });
      } else if (ageMinutes < 2) {
        map.set(session.sessionId, { label: `${ageMinutes}m ago`, cssClass: '' });
      } else if (ageMinutes < 10) {
        map.set(session.sessionId, { label: `${ageMinutes}m ago`, cssClass: 'heartbeat-warn' });
      } else {
        map.set(session.sessionId, { label: `${ageMinutes}m ago`, cssClass: 'heartbeat-stale' });
      }
    }
    return map;
  });

  public readonly startedAtLabels = computed(() => {
    const map = new Map<string, string>();
    for (const session of this.sessions) {
      map.set(
        session.sessionId,
        session.startedAt.length >= 16 ? session.startedAt.slice(11, 16) : session.startedAt,
      );
    }
    return map;
  });
}
