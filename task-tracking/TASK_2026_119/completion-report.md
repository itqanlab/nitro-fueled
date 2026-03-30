# Completion Report — TASK_2026_119

## Task
/nitro-burn Command — Token and Cost Analytics

## Review Verdicts

| Reviewer | Verdict |
|----------|---------|
| Code Style | PASS_WITH_NOTES |
| Code Logic | PASS_WITH_NOTES |
| Security | PASS_WITH_NOTES |

No FAIL verdicts. Testing: skip (per task.md).

## Issues Found

### HIGH Priority

| ID | Reviewer | Issue | Fix Required |
|----|----------|-------|-------------|
| S-H1 | Style | H1 title `# Burn` should be `# Nitro Burn` to match command family convention | Yes |
| S-H2 | Style | Argument validation embedded in Step 1 — should be extracted to Step 0 pre-flight | Yes |
| L-H1 | Logic | Duration `~Nm` tilde-prefixed values not handled — silently dropped in totals | Yes |
| L-H2 | Logic | Cost `~$X.XX` tilde-prefixed values undefined — inconsistent totals | Yes |
| L-H3 | Logic | `orchestrator-history.md` Session block format not covered — ambiguous Task ID extraction | Yes |
| L-H4 | Logic | `--since` filter undefined for history-only tasks (no session-analytics.md) | Yes |
| Sec-1 | Security | `--task TASK_ID` used in path construction without regex guard — path traversal risk | Yes |

### MEDIUM Priority

| ID | Reviewer | Issue |
|----|----------|-------|
| S-M1 | Style | Stale `/orchestrate` reference in empty-state — should be `/nitro-orchestrate` |
| S-M2 | Style | Duration parsing spec missing `Xh Ym` format |
| S-M4 | Style | Tool name written two ways (`list_workers(...)` vs `MCP list_workers`) |
| L-M1 | Logic | Workers fallback hardcoded to 1 — should count history rows per task |
| L-M2 | Logic | Outcome fallback from history uses non-canonical Result values (REVIEW_DONE, etc.) |
| L-M3 | Logic | Empty state guard ignores `orchestrator-history.md` as standalone source |
| L-M4 | Logic | Outcome enum in totals incomplete — missing IN_PROGRESS, BLOCKED, CANCELLED, etc. |
| Sec-2 | Security | Opaque data directive absent inline on orchestrator-history.md read path |
| Sec-3 | Security | MCP response fields rendered without character-cap directive |

## Fix Status

Fixes were attempted on both command files:
- `.claude/commands/nitro-burn.md`
- `apps/cli/scaffold/.claude/commands/nitro-burn.md`

Write permission was not granted during this review session. All proposed fixes are documented above and in the detailed review files. A follow-up build worker should apply these fixes.

## Proposed Fix Summary (for follow-up)

1. **H1 title**: `# Burn` → `# Nitro Burn — Token and Cost Analytics`
2. **Step 0**: Extract argument validation into new Step 0 block; renumber Steps 1–5 → 1–4
3. **TASK_ID regex**: Add `/^TASK_\d{4}_\d{3}$/` check before folder-existence check
4. **Tilde handling**: Strip `~` prefix from all Duration and Cost values before parsing; classify tilde-stripped values as "approximate real"
5. **History formats**: Document both Task Completion Entry and Session block formats; specify Task column extraction rule
6. **`--since` for history-only**: Use Session block header timestamp as date proxy; include by default if no date found
7. **Empty state guard**: Add `orchestrator-history.md` as third condition
8. **Duration parsing**: Extend to cover `Xh Ym` format alongside `Nm`
9. **`/orchestrate` → `/nitro-orchestrate`**: Fix stale reference in empty-state output
10. **Tool reference**: Normalize to `mcp__nitro-cortex__list_workers` throughout
11. **Workers fallback**: Count history rows per task instead of defaulting to 1
12. **Outcome mapping**: Add mapping table for non-canonical history Result values
13. **Outcome totals**: Change from fixed enum to "group all distinct values"
14. **Opaque data inline**: Add inline note on orchestrator-history.md read step
15. **MCP field cap**: Add 64-char cap and type-check directive for MCP response fields

## Outcome

Review COMPLETE. Implementation quality: solid happy-path, robust in common cases. The HIGH issues are parsing-rule gaps that will produce silent wrong totals against real production data (tilde values, Session block format). Recommend a targeted follow-up build pass to apply the 15 documented fixes.
