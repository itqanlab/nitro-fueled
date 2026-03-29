import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { ApiService } from '../../services/api.service';
import type { CortexPhaseTiming } from '../../../../../dashboard-api/src/dashboard/cortex.types';
import {
  adaptPhaseTiming,
  FALLBACK_PHASE_TIMING_ROWS,
  PhaseTimingRow,
} from './phase-timing.adapters';

@Component({
  selector: 'app-phase-timing',
  standalone: true,
  imports: [
    NgClass,
    DecimalPipe,
    NzTableModule,
    NzTagModule,
    NzEmptyModule,
    NzSkeletonModule,
  ],
  templateUrl: './phase-timing.component.html',
  styleUrl: './phase-timing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhaseTimingComponent {
  private readonly api = inject(ApiService);

  private readonly phaseTimingSignal = toSignal(
    this.api
      .getCortexPhaseTimings()
      .pipe(catchError(() => of(null as CortexPhaseTiming[] | null))),
    { initialValue: null as CortexPhaseTiming[] | null },
  );

  private readonly rowsComputed = computed<PhaseTimingRow[]>(() =>
    adaptPhaseTiming(this.phaseTimingSignal()),
  );

  public rows: PhaseTimingRow[] = [];
  public loading = true;
  public unavailable = false;

  constructor() {
    effect(() => {
      const raw = this.phaseTimingSignal();
      if (raw === null) {
        this.unavailable = true;
        this.loading = false;
        this.rows = FALLBACK_PHASE_TIMING_ROWS;
      } else {
        this.unavailable = false;
        this.loading = false;
        this.rows = this.rowsComputed();
      }
    });
  }

  public isOutlier(row: PhaseTimingRow): boolean {
    return row.maxMin !== null && row.maxMin > row.outlierThreshold;
  }
}
