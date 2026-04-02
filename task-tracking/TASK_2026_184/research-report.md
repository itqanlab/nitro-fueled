# Research Report — TASK_2026_184

## Existing Reusable Pieces

- `apps/dashboard/src/app/views/onboarding/chat-panel/` already contains a lightweight chat-style input/message pattern that can inform the console input and transcript layout.
- `apps/dashboard/src/app/views/session-viewer/session-viewer.component.ts` already renders markdown safely with `marked` and `DOMPurify`; this should be reused for command output rendering.
- `apps/dashboard/src/app/services/websocket.service.ts` already exposes live dashboard and cortex event streams, which can support live command/result refresh behavior without inventing a second frontend transport.
- `apps/dashboard-api/src/tasks/tasks.controller.ts` already exposes task creation via HTTP.
- `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` already exposes session-centric auto-pilot lifecycle actions over HTTP.
- `apps/dashboard-api/src/dashboard/dashboard.controller.ts` already exposes status, reports, progress, logs, session, and cortex read APIs that cover several likely console commands.
- `.claude/commands/*.md` is the source of truth for the Nitro command catalog and can drive autocomplete metadata.

## Current Gaps

- There is no existing dashboard command-console component or global shell host for a slide-out panel.
- There is no backend command catalog or execution facade for slash commands.
- There is no persistent command-history model in the dashboard frontend.
- There is no existing syntax-highlighting dependency in `apps/dashboard/package.json`; the implement worker may need to add one if styled code blocks alone are not sufficient to satisfy the acceptance criteria.

## Implications For Implementation

- The feature should be built as a thin command adapter layer, not as a raw shell bridge from the browser.
- The dashboard API is the right place to centralize command metadata, route-aware suggestions, and supported command execution handlers.
- The Angular layout shell is the right place to host the console so it remains available across all routes.
- Output rendering should reuse the existing markdown sanitization path and extend it with structured result sections rather than inventing a second renderer.
