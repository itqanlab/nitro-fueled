import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import type { StateStore } from '../state/store.js';

type RouteHandler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => void;

interface Route {
  readonly method: string;
  readonly pattern: RegExp;
  readonly paramNames: ReadonlyArray<string>;
  readonly handler: RouteHandler;
}

export function createHttpServer(store: StateStore): Server {
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

  function sendJson(res: ServerResponse, data: unknown, status = 200): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
  }

  addRoute('GET', '/health', (_req, res) => {
    sendJson(res, { status: 'ok', timestamp: new Date().toISOString() });
  });

  addRoute('GET', '/api/registry', (_req, res) => {
    sendJson(res, store.getRegistry());
  });

  addRoute('GET', '/api/plan', (_req, res) => {
    const plan = store.getPlan();
    sendJson(res, plan ?? { error: 'Plan not found' });
  });

  addRoute('GET', '/api/state', (_req, res) => {
    const state = store.getOrchestratorState();
    sendJson(res, state ?? { error: 'Orchestrator state not found' });
  });

  addRoute('GET', '/api/tasks/:id', (_req, res, params) => {
    const taskData = store.getFullTask(params.id);
    if (!taskData.definition && !taskData.registryRecord) {
      sendJson(res, { error: `Task ${params.id} not found` }, 404);
      return;
    }
    sendJson(res, taskData);
  });

  addRoute('GET', '/api/tasks/:id/reviews', (_req, res, params) => {
    sendJson(res, store.getReviews(params.id));
  });

  addRoute('GET', '/api/anti-patterns', (_req, res) => {
    sendJson(res, store.getAntiPatterns());
  });

  addRoute('GET', '/api/review-lessons', (_req, res) => {
    sendJson(res, store.getLessons());
  });

  addRoute('GET', '/api/stats', (_req, res) => {
    sendJson(res, store.getStats());
  });

  const server = createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    for (const route of routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(url);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, idx) => {
          params[name] = match[idx + 1];
        });
        route.handler(req, res, params);
        return;
      }
    }

    sendJson(res, { error: 'Not found' }, 404);
  });

  return server;
}
