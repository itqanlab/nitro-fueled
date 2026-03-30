# Task: Add Angular Route Guards

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P2-Medium   |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |
| Testing               | required    |

## Description

Add route guards to the Angular dashboard application. Currently all routes are accessible without any guards — flagged as a "systemic gap" in 5 task reviews (082, 083, 085, 086, 109). Implement a basic auth guard that checks for an authenticated session (or API key validity) and redirects to a login/config page when the guard fails.

This depends on TASK_2026_173 (backend auth) to have the API-side auth in place first. The frontend guard should check auth status via the API before allowing route access.

## Dependencies

- TASK_2026_173 — Backend auth guard must exist first

## Acceptance Criteria

- [ ] `AuthGuard` Angular guard implemented using `canActivate`
- [ ] All feature routes protected by the guard
- [ ] Unauthenticated access redirects to a simple config/login page
- [ ] Guard checks auth status against the dashboard-api
- [ ] Guard is bypassable for local dev via environment flag

## References

- Retrospective: `task-tracking/retrospectives/RETRO_2026-03-30.md` — Acknowledged-but-Unfixed
- Review files: TASK_2026_082, 083, 085, 086, 109

## File Scope

- apps/dashboard/src/app/guards/ (new)
- apps/dashboard/src/app/app.routes.ts
- apps/dashboard/src/app/views/login/ (new simple page)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_166-171 (dashboard features that add routes)
Suggested wave: Wave 2, after TASK_2026_173 completes
