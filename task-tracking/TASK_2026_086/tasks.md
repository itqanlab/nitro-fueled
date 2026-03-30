# Development Tasks - TASK_2026_086

## Batch 1: Scaffold NestJS app at apps/dashboard-api - COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Install @nx/nest and scaffold app

**File**: apps/dashboard-api/ (entire directory)
**Status**: COMPLETE
**Description**:
Install `@nx/nest` as a dev dependency in the root workspace. Run the Nx generator to scaffold `apps/dashboard-api`.

Use: `npx nx g @nx/nest:app dashboard-api --directory=apps/dashboard-api --no-interactive`

If the generator fails or adds unwanted files, manually create:
- apps/dashboard-api/project.json (build + serve targets, port 0)
- apps/dashboard-api/package.json (NestJS 11 deps)
- apps/dashboard-api/tsconfig.json (extends root tsconfig)
- apps/dashboard-api/src/main.ts (bootstrap with CORS + port 0)
- apps/dashboard-api/src/app/app.module.ts (root AppModule importing DashboardModule)
- apps/dashboard-api/src/dashboard/dashboard.module.ts (skeleton module)
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (empty class + @Get('/health'))
- apps/dashboard-api/src/dashboard/dashboard.service.ts (empty class)
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts (empty WebSocket gateway class)

### Task 1.2: Configure CORS and health endpoint

**File**: apps/dashboard-api/src/main.ts
**Status**: COMPLETE
**Description**:
Configure global CORS to allow all localhost origins (any port). Set HTTP listener port to 0 (OS auto-assign), configurable via `PORT` env var.

The health endpoint `GET /health` must return `{ status: 'ok', service: 'nitro-fueled-dashboard-api' }` (200 OK). This endpoint must be in the AppController or a HealthController — NOT gated by any auth or guard.

### Task 1.3: Install NestJS dependencies

**File**: apps/dashboard-api/package.json
**Status**: COMPLETE
**Description**:
Install NestJS 11 core packages. The app needs:
- @nestjs/core, @nestjs/common, @nestjs/platform-express
- @nestjs/websockets, @nestjs/platform-socket.io (for gateway skeleton)
- reflect-metadata, rxjs

These can be workspace-level (root package.json) or app-level (apps/dashboard-api/package.json).
