import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CortexService } from './cortex.service';
import { PipelineService } from './pipeline.service';
import { WatcherService } from './watcher.service';
import type { TaskRecord } from './dashboard.types';

/**
 * Hydrates PipelineService from the cortex SQLite DB on startup
 * and refreshes on file changes.
 */
@Injectable()
export class HydrationService implements OnModuleInit {
  private readonly logger = new Logger(HydrationService.name);

  public constructor(
    private readonly cortex: CortexService,
    private readonly pipeline: PipelineService,
    private readonly watcher: WatcherService,
  ) {}

  public onModuleInit(): void {
    this.hydrate();
    this.watcher.subscribe(() => {
      this.hydrate();
    });
  }

  public hydrate(): void {
    const cortexTasks = this.cortex.getTasks();
    if (!cortexTasks) {
      this.logger.warn('Cortex DB unavailable — skipping hydration');
      return;
    }

    const records: TaskRecord[] = cortexTasks.map((t) => ({
      id: t.id,
      status: t.status as TaskRecord['status'],
      type: t.type as TaskRecord['type'],
      description: t.title,
      created: t.created_at,
      model: '',
    }));

    this.pipeline.setRegistry(records);
    this.logger.log(`Hydrated ${records.length} tasks from cortex`);
  }
}
