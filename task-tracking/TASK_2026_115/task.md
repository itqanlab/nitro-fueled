# Task: Extract Inline Template/Styles in Agent Editor Sub-Components

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P3-Low      |
| Complexity | Simple      |
| Model      | default     |
| Testing    | skip        |

## Description

Three sub-components in the agent-editor feature use inline `template:` and `styles:` arrays while every other component in the feature and wider codebase uses external `.html` and `.scss` files. This inconsistency was flagged in the TASK_2026_080 code style review (Serious Issue 5) but deferred.

Extract inline templates and styles to external files for:
1. `mcp-tool-access.component.ts` (112 lines)
2. `knowledge-scope.component.ts` (108 lines)
3. `compatibility-list.component.ts` (80 lines)

Each component gets a `.html` and `.scss` file alongside its `.ts` file, and the `@Component` decorator switches from inline `template:`/`styles:` to `templateUrl:`/`styleUrl:`.

> **Sizing note**: 9 files in scope (exceeds 7-file guideline) but all are in the same directory performing the same mechanical extraction. No architectural decisions, no cross-layer changes. Single-worker safe.

## Dependencies

- None

## Acceptance Criteria

- [ ] All 3 components use `templateUrl` and `styleUrl` instead of inline `template` and `styles`
- [ ] 6 new files created (3 `.html` + 3 `.scss`)
- [ ] No functional changes — templates and styles extracted as-is
- [ ] Angular build passes (`npx nx build dashboard`)

## Parallelism

✅ Can run in parallel — no direct file scope overlap with other CREATED tasks. Dashboard view tasks (TASK_2026_082-085) touch different directories within the dashboard app.

## References

- TASK_2026_080 review-style.md — Serious Issue 5
- `.claude/review-lessons/frontend.md` — "All components in a feature must use the same template/styles convention"

## File Scope

- `apps/dashboard/src/app/views/agent-editor/metadata-panel/mcp-tool-access.component.ts`
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/mcp-tool-access.component.html` (new)
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/mcp-tool-access.component.scss` (new)
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/knowledge-scope.component.ts`
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/knowledge-scope.component.html` (new)
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/knowledge-scope.component.scss` (new)
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/compatibility-list.component.ts`
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/compatibility-list.component.html` (new)
- `apps/dashboard/src/app/views/agent-editor/metadata-panel/compatibility-list.component.scss` (new)
