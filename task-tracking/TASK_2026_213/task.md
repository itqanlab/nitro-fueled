# TASK_2026_213 — Add NestJS DTO Validation to Command Console Endpoints

## Metadata
| Field | Value |
|-------|-------|
| Title | Refactor Command Console Controller — NestJS DTO Validation |
| Type | REFACTORING |
| Priority | P3-Low |
| Complexity | Simple |
| Status | CREATED |
| Dependencies | TASK_2026_184 |
| Created | 2026-03-30 |

## Description
Replace manual validation in command-console.controller.ts with NestJS DTO classes using class-validator decorators. Create ExecuteCommandDto and GetSuggestionsDto. Apply ValidationPipe. Remove manual validation.

## File Scope
- apps/dashboard-api/src/dashboard/command-console.controller.ts
- apps/dashboard-api/src/dashboard/dto/ (new DTOs)

## Parallelism
- Can run in parallel: Yes
- Conflicts with: TASK_2026_184
- Wave: after 184 complete
