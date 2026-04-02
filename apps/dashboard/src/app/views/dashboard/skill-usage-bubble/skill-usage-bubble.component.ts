import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
  effect,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { hierarchy, pack, type HierarchyCircularNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { ApiService } from '../../../services/api.service';
import type { AnalyticsSkillUsageItem } from '../../../models/api.types';

interface BubbleDatum {
  name: string;
  value: number;
  avgDurationMs: number | null;
}

type Period = '7d' | '30d' | '90d' | 'all';

const PERIOD_OPTIONS: Array<{ label: string; value: Period }> = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

/** Maps avg duration ratio (0–1) to a CSS rgb color. Cool = fast, warm = slow. */
function durationColor(ms: number | null, maxMs: number): string {
  if (ms === null || maxMs === 0) return 'rgb(76,155,232)';
  const ratio = Math.min(ms / maxMs, 1);
  if (ratio < 0.5) {
    const t = ratio * 2;
    return `rgb(${Math.round(76 + t * 179)},${Math.round(155 + t * 10)},${Math.round(232 - t * 232)})`;
  }
  const t = (ratio - 0.5) * 2;
  return `rgb(${Math.round(255 - t * 35)},${Math.round(165 - t * 115)},0)`;
}

@Component({
  selector: 'app-skill-usage-bubble',
  standalone: true,
  imports: [FormsModule, NzSelectModule, NzSkeletonModule, NzEmptyModule],
  templateUrl: './skill-usage-bubble.component.html',
  styleUrl: './skill-usage-bubble.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillUsageBubbleComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartContainer', { static: false }) private chartContainer!: ElementRef<HTMLDivElement>;

  private readonly api = inject(ApiService);
  private readonly resizeObserver: ResizeObserver;
  private readonly period$ = new BehaviorSubject<Period>('30d');

  private readonly rawData = toSignal(
    this.period$.pipe(
      switchMap(period =>
        this.api.getAnalyticsSkillUsage(period).pipe(catchError(() => of(null))),
      ),
    ),
  );

  public readonly periodOptions = PERIOD_OPTIONS;
  public selectedPeriod: Period = '30d';
  public loading = true;
  public unavailable = false;
  public empty = false;

  public readonly tooltip = signal<{
    x: number; y: number;
    skill: string; count: number; avgDurationMs: number | null;
  } | null>(null);

  public readonly hasTooltip = computed(() => this.tooltip() !== null);

  constructor() {
    this.resizeObserver = new ResizeObserver(() => this.redraw());

    effect(() => {
      const data = this.rawData();
      if (data === undefined) return;
      this.loading = false;
      if (data === null) {
        this.unavailable = true;
        this.empty = false;
        return;
      }
      this.unavailable = false;
      const items = data.data as AnalyticsSkillUsageItem[];
      this.empty = items.length === 0;
      if (!this.empty) {
        // Draw on next tick so the container is visible in the DOM
        setTimeout(() => this.draw(items), 0);
      }
    });
  }

  public ngAfterViewInit(): void {
    if (this.chartContainer?.nativeElement) {
      this.resizeObserver.observe(this.chartContainer.nativeElement);
    }
  }

  public ngOnDestroy(): void {
    this.resizeObserver.disconnect();
  }

  public onPeriodChange(period: Period): void {
    this.loading = true;
    this.empty = false;
    this.period$.next(period);
  }

  private redraw(): void {
    const data = this.rawData();
    if (data && 'data' in data) {
      this.draw(data.data as AnalyticsSkillUsageItem[]);
    }
  }

  private draw(items: AnalyticsSkillUsageItem[]): void {
    const container = this.chartContainer?.nativeElement;
    if (!container || items.length === 0) return;

    const width = container.clientWidth || 600;
    const height = Math.max(280, Math.min(width * 0.55, 480));

    select(container).selectAll('svg').remove();

    const bubbles: BubbleDatum[] = items.map(item => ({
      name: item.skill,
      value: item.count,
      avgDurationMs: item.avgDurationMs,
    }));

    const maxMs = Math.max(...bubbles.map(b => b.avgDurationMs ?? 0));

    const root = hierarchy<{ children?: BubbleDatum[] } | BubbleDatum>({ children: bubbles })
      .sum(d => ('value' in d ? (d as BubbleDatum).value : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    pack<{ children?: BubbleDatum[] } | BubbleDatum>()
      .size([width, height])
      .padding(4)(root);

    const svg = select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', 'Skill usage bubble chart');

    type PackNode = HierarchyCircularNode<{ children?: BubbleDatum[] } | BubbleDatum>;
    const leaves = root.leaves() as unknown as PackNode[];

    const node = svg
      .selectAll<SVGGElement, PackNode>('g')
      .data(leaves)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer');

    node.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => durationColor((d.data as BubbleDatum).avgDurationMs, maxMs))
      .attr('fill-opacity', 0.85)
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 1.5);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', d => `${Math.min(d.r * 0.38, 11)}px`)
      .style('fill', '#fff')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text(d => (d.r > 20 ? this.truncate((d.data as BubbleDatum).name, Math.floor(d.r / 4.5)) : ''));

    node.on('mouseenter', (event: MouseEvent, d: PackNode) => {
      const bubble = d.data as BubbleDatum;
      const rect = container.getBoundingClientRect();
      this.tooltip.set({
        x: event.clientX - rect.left + 14,
        y: event.clientY - rect.top - 10,
        skill: bubble.name,
        count: bubble.value,
        avgDurationMs: bubble.avgDurationMs,
      });
    });

    node.on('mousemove', (event: MouseEvent) => {
      const tt = this.tooltip();
      if (!tt) return;
      const rect = container.getBoundingClientRect();
      this.tooltip.set({ ...tt, x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 10 });
    });

    node.on('mouseleave', () => this.tooltip.set(null));
  }

  private truncate(text: string, maxChars: number): string {
    if (maxChars < 2) return '';
    return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
  }

  public formatDuration(ms: number | null): string {
    if (ms === null) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
}
