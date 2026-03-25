import { DashboardService } from './index.js';

function parseArgs(args: ReadonlyArray<string>): {
  taskTrackingDir: string;
  port: number;
  antiPatternsPath?: string;
  reviewLessonsDir?: string;
  webDistPath?: string;
} {
  let taskTrackingDir = '';
  let port = 4200;
  let antiPatternsPath: string | undefined;
  let reviewLessonsDir: string | undefined;
  let webDistPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--task-tracking-dir':
        taskTrackingDir = args[++i] ?? '';
        break;
      case '--port':
        port = parseInt(args[++i] ?? '4200', 10);
        break;
      case '--anti-patterns':
        antiPatternsPath = args[++i];
        break;
      case '--review-lessons':
        reviewLessonsDir = args[++i];
        break;
      case '--web-dist':
        webDistPath = args[++i];
        break;
    }
  }

  if (!taskTrackingDir) {
    console.error('Error: --task-tracking-dir is required');
    process.exit(1);
  }

  return { taskTrackingDir, port, antiPatternsPath, reviewLessonsDir, webDistPath };
}

const config = parseArgs(process.argv.slice(2));

const service = new DashboardService({
  taskTrackingDir: config.taskTrackingDir,
  port: config.port,
  antiPatternsPath: config.antiPatternsPath,
  reviewLessonsDir: config.reviewLessonsDir,
  webDistPath: config.webDistPath,
});

service.start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dashboard-service] Failed to start: ${message}`);
  process.exit(1);
});
