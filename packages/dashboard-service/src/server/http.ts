import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { readFile } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { StateStore } from '../state/store.js';
import type { SessionStore } from '../state/session-store.js';
import type { AnalyticsStore } from '../state/analytics-store.js';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Localhost-only CORS: allow the specific origins that the dashboard client runs on.
// Wildcard (*) is intentionally avoided to prevent arbitrary browser tabs from reading
// orchestration state via a backgrounded service.
const ALLOWED_ORIGINS = new Set(['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4200']);

type RouteHandler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => void;

interface Route {
  readonly method: string;
  readonly pattern: RegExp;
  readonly paramNames: ReadonlyArray<string>;
  readonly handler: RouteHandler;
}

function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export function createHttpServer(store: StateStore, sessionStore: SessionStore, analyticsStore?: AnalyticsStore, webDistPath?: string): Server {
  const routes: Route[] = [];

  function addRoute(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const patternStr = path.replace(/:(\w+)/g, (_match, name: string) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    routes.push({
      method,
      pattern: new RegExp(`^${patternStr}$`),
      paramNames,
      handler,
    });
  }

  function sendJson(res: ServerResponse, req: IncomingMessage, data: unknown, status = 200): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      ...getCorsHeaders(req.headers.origin),
    });
    res.end(JSON.stringify(data));
  }

  addRoute('GET', '/health', (req, res) => {
    sendJson(res, req, { status: 'ok', service: 'nitro-fueled-dashboard', timestamp: new Date().toISOString() });
  });

  addRoute('GET', '/api/registry', (req, res) => {
    sendJson(res, req, store.getRegistry());
  });

  addRoute('GET', '/api/plan', (req, res) => {
    const plan = store.getPlan();
    sendJson(res, req, plan ?? { error: 'Plan not found' });
  });

  addRoute('GET', '/api/state', (req, res) => {
    const state = store.getOrchestratorState();
    sendJson(res, req, state ?? { error: 'Orchestrator state not found' });
  });

  addRoute('GET', '/api/tasks/:id', (req, res, params) => {
    const taskData = store.getFullTask(params.id);
    if (!taskData.definition && !taskData.registryRecord) {
      sendJson(res, req, { error: `Task ${params.id} not found` }, 404);
      return;
    }
    sendJson(res, req, taskData);
  });

  addRoute('GET', '/api/tasks/:id/reviews', (req, res, params) => {
    sendJson(res, req, store.getReviews(params.id));
  });

  addRoute('GET', '/api/anti-patterns', (req, res) => {
    sendJson(res, req, store.getAntiPatterns());
  });

  addRoute('GET', '/api/review-lessons', (req, res) => {
    sendJson(res, req, store.getLessons());
  });

  addRoute('GET', '/api/stats', (req, res) => {
    sendJson(res, req, store.getStats());
  });

  addRoute('GET', '/api/graph', (req, res) => {
    sendJson(res, req, store.getGraph());
  });

  addRoute('GET', '/api/tasks/:id/pipeline', (req, res, params) => {
    if (!/^TASK_\d{4}_\d{3}$/.test(params.id)) {
      sendJson(res, req, { error: 'Invalid task ID format' }, 400);
      return;
    }
    const record = store.getRegistry().find((r) => r.id === params.id);
    if (!record) {
      sendJson(res, req, { error: `Task ${params.id} not found` }, 404);
      return;
    }
    sendJson(res, req, store.getTaskPipeline(params.id));
  });

  addRoute('GET', '/api/workers/tree', (req, res) => {
    sendJson(res, req, store.getWorkerTree());
  });

  // CRITICAL ORDER: register /api/sessions/active before /api/sessions/:id to prevent
  // "active" from being captured as the :id parameter.
  addRoute('GET', '/api/sessions/active', (req, res) => {
    sendJson(res, req, sessionStore.getActiveSessions());
  });

  addRoute('GET', '/api/sessions/:id', (req, res, params) => {
    const data = sessionStore.getSession(params.id);
    if (!data) {
      sendJson(res, req, { error: `Session ${params.id} not found` }, 404);
      return;
    }
    sendJson(res, req, data);
  });

  addRoute('GET', '/api/sessions', (req, res) => {
    sendJson(res, req, sessionStore.getSessions());
  });

  addRoute('GET', '/api/analytics/cost', (req, res) => {
    const promise = analyticsStore?.getCostData() ?? Promise.resolve({ sessions: [], cumulativeCost: 0, hypotheticalOpusCost: 0 });
    promise.then((data) => sendJson(res, req, data)).catch(() => sendJson(res, req, { error: 'Analytics unavailable' }, 500));
  });

  addRoute('GET', '/api/analytics/efficiency', (req, res) => {
    const promise = analyticsStore?.getEfficiencyData() ?? Promise.resolve({ sessions: [] });
    promise.then((data) => sendJson(res, req, data)).catch(() => sendJson(res, req, { error: 'Analytics unavailable' }, 500));
  });

  addRoute('GET', '/api/analytics/models', (req, res) => {
    const promise = analyticsStore?.getModelsData() ?? Promise.resolve({ models: [], totalCost: 0, hypotheticalOpusCost: 0, actualSavings: 0 });
    promise.then((data) => sendJson(res, req, data)).catch(() => sendJson(res, req, { error: 'Analytics unavailable' }, 500));
  });

  addRoute('GET', '/api/analytics/sessions', (req, res) => {
    const promise = analyticsStore?.getSessionsData() ?? Promise.resolve({ sessions: [] });
    promise.then((data) => sendJson(res, req, data)).catch(() => sendJson(res, req, { error: 'Analytics unavailable' }, 500));
  });

  const server = createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, getCorsHeaders(req.headers.origin));
      res.end();
      return;
    }

    const pathname = req.url?.split('?')[0] ?? '/';
    const method = req.method ?? 'GET';

    for (const route of routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(pathname);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, idx) => {
          params[name] = match[idx + 1];
        });
        route.handler(req, res, params);
        return;
      }
    }

    const isApiPath = pathname === '/health' || pathname === '/api' || pathname.startsWith('/api/');
    const requestExt = extname(pathname);
    const isRouteLikePath = requestExt.length === 0;

    // Serve static files from webDistPath with path traversal protection.
    // For SPA routing, any non-API GET path falls back to index.html.
    if (webDistPath && method === 'GET' && !isApiPath) {
      const resolvedBase = resolve(webDistPath);
      const filePath = pathname === '/' ? 'index.html' : pathname.slice(1);
      const fullPath = resolve(join(resolvedBase, filePath));

      // Reject any path that escapes the web root.
      if (!fullPath.startsWith(resolvedBase + '/') && fullPath !== resolvedBase) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }

      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

      readFile(fullPath, (err, data) => {
        if (err) {
          // Fall back to index.html only for extension-less SPA routes.
          if (filePath !== 'index.html' && isRouteLikePath) {
            readFile(join(resolvedBase, 'index.html'), (fallbackErr, indexData) => {
              if (fallbackErr) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
                return;
              }
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(indexData);
            });
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
          }
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return server;
}
