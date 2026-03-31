# Handoff — TASK_2026_175

## Files Changed
- apps/dashboard/src/app/services/auth.service.ts (new, 41 lines)
- apps/dashboard/src/app/guards/auth.guard.ts (new, 14 lines)
- apps/dashboard/src/app/views/login/login.component.ts (new, 69 lines)
- apps/dashboard/src/app/views/login/login.component.html (new)
- apps/dashboard/src/app/views/login/login.component.scss (new)
- apps/dashboard/src/app/app.routes.ts (modified — added login route, authGuard, wildcard redirect)

## Commits
- (see implementation commit)

## Decisions
- Used functional guard (`CanActivateFn`) over class-based guard — consistent with Angular 17+ best practices
- Auth check is synchronous (signal-based) — no async guard needed since the key is already in localStorage
- Verification calls `/api/v1/health` (exempt endpoint on backend when AUTH_ENABLED=false, but still accepts the key header) — this lets the frontend validate the key without a dedicated auth endpoint
- API key stored in localStorage under `nitro_api_key` key — simple, no expiry needed for this use case
- Guard applied to the root `path: ''` layout route only — `/login` is outside the guarded zone

## Known Risks
- `auth.service.ts` uses `localStorage` directly in the constructor — this will break in SSR contexts, but this is a client-only app so not a concern
- Auth guard is synchronous; if future requirements need async auth checking (e.g., token refresh), the guard would need to return `Observable<boolean>` instead
- The health endpoint verification is a best-effort check — it verifies connectivity + key validity together, so a network failure will show "invalid key" rather than "unreachable"
