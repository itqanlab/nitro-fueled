# Task: API Contract Layer — OpenAPI Spec, Typed DTOs, Versioned Endpoints

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |
| Model      | default |
| Testing    | skip    |

## Description

The NestJS dashboard-api must have a formal **API contract** so that any client (Angular dashboard, future mobile app, CLI, third-party integrations) can consume it without reading frontend code. The Angular app is a **client**, not the core — the API is the source of truth.

### What to Build

1. **OpenAPI/Swagger integration** — Add `@nestjs/swagger` to the NestJS app. Configure Swagger UI at `/api/docs`. Every controller endpoint gets OpenAPI decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiBody`).

2. **Typed DTOs** — Every request body and response has a dedicated DTO class with:
   - Class-validator decorators for input validation
   - Swagger decorators for documentation
   - Exported from a shared location so clients can import types

3. **API versioning** — Use NestJS URI versioning (`/api/v1/...`). All current endpoints move under `/api/v1/`. This allows future breaking changes without disrupting existing clients.

4. **Response envelope** — Standardize all responses:
   ```json
   {
     "success": true,
     "data": { ... },
     "meta": { "timestamp": "...", "version": "v1" }
   }
   ```
   Error responses:
   ```json
   {
     "success": false,
     "error": { "code": "NOT_FOUND", "message": "..." },
     "meta": { "timestamp": "...", "version": "v1" }
   }
   ```

5. **Contract export** — Auto-generate `openapi.json` spec file on build. This file can be used by any client to generate typed SDKs (e.g., `openapi-generator` for mobile apps).

### Architectural Principle

The Angular dashboard is one of potentially many clients. All business logic lives in the API. The frontend is a **presentation layer only** — it calls the API, renders the response, and sends user actions back. No business logic in the frontend.

## Dependencies

- TASK_2026_087 — REST controllers must exist before adding contracts to them

## Acceptance Criteria

- [ ] `@nestjs/swagger` installed and configured
- [ ] Swagger UI accessible at `/api/docs`
- [ ] All existing controller endpoints have OpenAPI decorators
- [ ] All request/response shapes have typed DTO classes with validation
- [ ] API versioned under `/api/v1/`
- [ ] Standardized response envelope for all endpoints
- [ ] `openapi.json` auto-generated on build
- [ ] No business logic in Angular app — frontend is presentation only

## References

- Dashboard API: `apps/dashboard-api/`
- NestJS Swagger docs: `@nestjs/swagger`
- Existing controllers from TASK_2026_087

## File Scope

- apps/dashboard-api/src/main.ts
- apps/dashboard-api/src/app/dtos/
- apps/dashboard-api/src/app/controllers/
- apps/dashboard-api/src/app/interceptors/
- apps/dashboard-api/package.json

## Parallelism

- ✅ Can run in parallel with dashboard frontend tasks (082–085) — no file overlap
- 🚫 Do NOT run in parallel with TASK_2026_088 — both modify dashboard-api controllers
- Suggested execution wave: Wave 2
