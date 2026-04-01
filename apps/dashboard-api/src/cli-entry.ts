/**
 * CLI entry point — spawned by `npx nitro-fueled dashboard`.
 *
 * Accepts CLI args from the dashboard command, starts the NestJS server,
 * optionally serves the Angular web UI as static files, and writes a
 * `.dashboard-port` file so the CLI can discover the actual port.
 */
import 'reflect-metadata';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { ResponseEnvelopeInterceptor } from './app/interceptors/response-envelope.interceptor';
import { ErrorEnvelopeFilter } from './app/filters/error-envelope.filter';

/* ------------------------------------------------------------------ */
/*  Arg parsing                                                       */
/* ------------------------------------------------------------------ */

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') && i + 1 < argv.length) {
      const key = arg.slice(2);
      result[key] = argv[++i];
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const taskTrackingDir = args['task-tracking-dir'] || join(process.cwd(), 'task-tracking');
const requestedPort = parseInt(args['port'] || '0', 10);
const webDistPath = args['web-dist'];
const antiPatternsPath = args['anti-patterns'];
const reviewLessonsDir = args['review-lessons'];

// Expose to NestJS services via env
if (antiPatternsPath) process.env['ANTI_PATTERNS_PATH'] = antiPatternsPath;
if (reviewLessonsDir) process.env['REVIEW_LESSONS_DIR'] = reviewLessonsDir;

/* ------------------------------------------------------------------ */
/*  Port file management                                              */
/* ------------------------------------------------------------------ */

const portFilePath = join(taskTrackingDir, '.dashboard-port');

function writePortFile(port: number): void {
  try {
    writeFileSync(portFilePath, String(port), 'utf-8');
  } catch {
    /* non-fatal — CLI will fall back to legacy health check */
  }
}

function cleanupPortFile(): void {
  try {
    if (existsSync(portFilePath)) unlinkSync(portFilePath);
  } catch {
    /* best-effort */
  }
}

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                         */
/* ------------------------------------------------------------------ */

async function bootstrap(): Promise<void> {
  const logger = new Logger('cli-entry');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: /^https?:\/\/localhost(:\d+)?$/,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new ErrorEnvelopeFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Nitro-Fueled Dashboard API')
    .setDescription('Internal dev-tool API for the Nitro-Fueled orchestration dashboard.')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ---- Unversioned /health for CLI service discovery ----
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({ status: 'ok', service: 'nitro-fueled-dashboard' });
  });

  // ---- Serve Angular web UI as static files ----
  if (webDistPath && existsSync(webDistPath)) {
    app.useStaticAssets(webDistPath);

    // SPA fallback: any non-API, non-file request serves index.html
    const indexPath = join(webDistPath, 'index.html');
    if (existsSync(indexPath)) {
      expressApp.use((req: { path: string; method: string }, res: { sendFile: (path: string) => void }, next: () => void) => {
        // Only handle GET requests for SPA fallback
        if (req.method !== 'GET') return next();
        // Skip API routes, health, swagger, socket.io, and file requests with extensions
        if (
          req.path.startsWith('/v1/') ||
          req.path.startsWith('/api/') ||
          req.path === '/health' ||
          req.path.startsWith('/socket.io') ||
          /\.\w+$/.test(req.path)
        ) {
          return next();
        }
        res.sendFile(resolve(indexPath));
      });
    }

    logger.log(`Serving web UI from: ${webDistPath}`);
  }

  // ---- Start listening ----
  await app.listen(requestedPort);

  const url = await app.getUrl();
  const actualPort = new URL(url.replace('[::1]', 'localhost')).port;
  writePortFile(parseInt(actualPort, 10));

  logger.log(`Dashboard running at ${url}`);
  if (webDistPath) {
    logger.log(`Web UI: ${url}`);
  }
  logger.log(`API docs: ${url}/api/docs`);

  // Cleanup on exit
  const shutdown = async (): Promise<void> => {
    cleanupPortFile();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err: unknown) => {
  cleanupPortFile();
  const logger = new Logger('cli-entry');
  logger.error(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
