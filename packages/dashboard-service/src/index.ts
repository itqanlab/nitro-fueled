import { existsSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createHttpServer } from './server/http.js';
import { WebSocketBroadcaster } from './server/websocket.js';
import { ChokidarWatcher } from './watcher/chokidar.watcher.js';
import type { FileWatcher } from './watcher/watcher.interface.js';
import { createEventBus } from './events/event-bus.js';
import { StateStore } from './state/store.js';
import { SessionStore } from './state/session-store.js';
import { FileRouter } from './parsers/file-router.js';
import type { Server } from 'node:http';

export const PORT_FILE_NAME = '.dashboard-port';

export interface DashboardServiceOptions {
  readonly taskTrackingDir: string;
  readonly antiPatternsPath?: string;
  readonly reviewLessonsDir?: string;
  readonly port: number;
  readonly webDistPath?: string;
}

export class DashboardService {
  private readonly store: StateStore;
  private readonly sessionStore: SessionStore;
  private readonly eventBus: ReturnType<typeof createEventBus>;
  private readonly watcher: FileWatcher;
  private readonly wsBroadcaster: WebSocketBroadcaster;
  private readonly fileRouter: FileRouter;
  private readonly options: DashboardServiceOptions;
  private httpServer: Server | null = null;

  public constructor(options: DashboardServiceOptions) {
    this.options = options;
    this.store = new StateStore();
    this.sessionStore = new SessionStore();
    this.eventBus = createEventBus();
    this.watcher = new ChokidarWatcher();
    this.wsBroadcaster = new WebSocketBroadcaster();
    this.fileRouter = new FileRouter(this.store, this.sessionStore, this.eventBus);
  }

  public async start(): Promise<void> {
    const server = createHttpServer(this.store, this.sessionStore, this.options.webDistPath);
    this.httpServer = server;

    this.wsBroadcaster.attach(server, this.eventBus);

    await new Promise<void>((res) => {
      server.listen(this.options.port, () => res());
    });

    const actualPort = (server.address() as AddressInfo).port;
    const portFilePath = join(this.options.taskTrackingDir, PORT_FILE_NAME);
    writeFileSync(portFilePath, String(actualPort), 'utf-8');

    this.watchTaskTracking();
    this.watchAntiPatterns();
    this.watchReviewLessons();
    this.registerShutdownHandlers();

    console.log(`[dashboard-service] Listening on http://localhost:${actualPort}`);
    console.log(`[dashboard-service] WebSocket available on ws://localhost:${actualPort}`);
    console.log(`[dashboard-service] Watching: ${this.options.taskTrackingDir}`);
  }

  public async stop(): Promise<void> {
    console.log('[dashboard-service] Shutting down...');
    const portFilePath = join(this.options.taskTrackingDir, PORT_FILE_NAME);
    try {
      unlinkSync(portFilePath);
    } catch {
      // ignore — file may not exist if startup failed before writing
    }
    await this.watcher.close();
    this.wsBroadcaster.close();
    if (this.httpServer) {
      await new Promise<void>((res) => {
        this.httpServer!.close(() => res());
      });
      this.httpServer = null;
    }
  }

  public getStore(): StateStore {
    return this.store;
  }

  public getSessionStore(): SessionStore {
    return this.sessionStore;
  }

  private watchTaskTracking(): void {
    for (const filePath of this.listMarkdownFilesRecursive(this.options.taskTrackingDir)) {
      this.fileRouter.handleChange(filePath);
    }

    this.watcher.watch(this.options.taskTrackingDir, (filePath, event) => {
      if (!filePath.endsWith('.md')) return;

      if (event === 'unlink') {
        this.fileRouter.handleRemoval(filePath);
        return;
      }

      this.fileRouter.handleChange(filePath);
    });
  }

  private listMarkdownFilesRecursive(dir: string): ReadonlyArray<string> {
    if (!existsSync(dir)) return [];
    const files: string[] = [];
    const walk = (current: string): void => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const fullPath = join(current, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    };

    walk(dir);
    return files;
  }

  private watchAntiPatterns(): void {
    const path = this.options.antiPatternsPath;
    if (!path || !existsSync(path)) return;

    this.fileRouter.handleChange(path);
    this.watcher.watch(path, (filePath, event) => {
      if (event === 'unlink') return;
      this.fileRouter.handleChange(filePath);
    });
  }

  private watchReviewLessons(): void {
    const dir = this.options.reviewLessonsDir;
    if (!dir || !existsSync(dir)) return;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      this.fileRouter.handleChange(join(dir, entry.name));
    }

    this.watcher.watch(dir, (filePath, event) => {
      if (!filePath.endsWith('.md') || event === 'unlink') return;
      this.fileRouter.handleChange(filePath);
    });
  }

  private registerShutdownHandlers(): void {
    const shutdown = (): void => { void this.stop().then(() => process.exit(0)); };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}

export function discoverTaskTrackingDir(cwd: string): string | null {
  const candidate = resolve(cwd, 'task-tracking');
  return existsSync(candidate) ? candidate : null;
}

export { StateStore } from './state/store.js';
export { SessionStore } from './state/session-store.js';
export type {
  TaskRecord,
  PlanData,
  OrchestratorState,
  TaskDefinition,
  ReviewData,
  CompletionReport,
  AntiPatternRule,
  LessonEntry,
  FullTaskData,
  DashboardStats,
  DashboardEvent,
  DashboardEventType,
  ActiveSessionRecord,
  SessionSummary,
  SessionData,
} from './events/event-types.js';
