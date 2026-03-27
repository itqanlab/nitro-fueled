# Code Style Review — TASK_2026_049

**Reviewer:** code-style-reviewer
**Task:** AI-Assisted Workspace Analysis for Stack Detection
**Commit:** `e2508a5 feat(TASK_2026_049): add AI-assisted workspace analysis for stack detection`
**Status:** ISSUES FOUND

---

## Summary

4 files reviewed. Critical violations found in `stack-detect.ts` (multiple `as` assertions). Major issues in `workspace-signals.ts` (file size, swallowed errors), and `init.ts` (unused import, dead parameter). `agent-map.ts` is clean.

---

## Issues by Severity

### CRITICAL

#### [C1] `stack-detect.ts` — Multiple `as` type assertions violating project convention

Project convention: **No `as` type assertions — use type guards or generics instead.**

Violations found:

| Line | Code | Issue |
|------|------|-------|
| 107 | `pkg = JSON.parse(content) as PackageJson;` | `as` assertion; use a type guard to validate the shape |
| 395 | `const obj = parsed as Record<string, unknown>;` | `as` assertion on `unknown`; `parsed` is already `unknown` — narrow with `typeof` guard first |
| 399 | `(obj['domains'] as unknown[]).filter(...)` | `as unknown[]` assertion — use `Array.isArray` guard, which is already done one line above; redundant cast on top of it |
| 405 | `for (const raw of obj['agents'] as unknown[])` | `as unknown[]` — same pattern; `Array.isArray` guard already applied on line 402 |
| 407 | `const a = raw as Record<string, unknown>;` | `as` assertion; `raw` is `unknown`; use `typeof raw === 'object' && raw !== null` guard |
| 410 | `a['confidence'] as 'high' \| 'medium' \| 'low'` | `as` narrow assertion; already guarded by `validConfidences.has(a['confidence'])` — reassign to typed const instead |

The `parseAIAnalysisResponse` function has the highest density of violations (5 of the 6 above). The function does perform type checks, but falls back to `as` for the final narrowing steps rather than letting the checks drive the type inference.

---

### MAJOR

#### [M1] `workspace-signals.ts` — File exceeds 200-line service limit (298 lines)

Convention: **Services: max 200 lines.**

`workspace-signals.ts` is 298 lines, 49% over the limit. Natural split points:

- **Lines 1–53** — constants and interface (`WorkspaceSignals`, `IGNORED_DIRS`, `CONFIG_FILES`, `MAX_CONFIG_BYTES`)
- **Lines 55–101** — filesystem traversal (`readFileSafe`, `walkTree`)
- **Lines 103–230** — signal collectors (`buildExtensionHistogram`, `detectPresenceMarkers`, `collectConfigFiles`)
- **Lines 232–298** — public API (`collectWorkspaceSignals`, `formatSignalsForPrompt`)

A `workspace-collectors.ts` extraction would bring each file under the limit, but that refactor is out of this task's scope. Flag for the next task.

#### [M2] `workspace-signals.ts` — Empty catch blocks swallow errors

Convention: **Never swallow errors — at minimum, log them. No empty catch blocks.**

| Location | Line(s) | Issue |
|----------|---------|-------|
| `readFileSafe` | 59 | `catch {}` — silently returns `''`; no log, no rethrow |
| `walkTree` — `readdirSync` | 75 | `catch {}` — silently returns `[]` |
| `walkTree` — `statSync` | 85–88 | `catch { continue; }` — silently skips entry |
| `collectConfigFiles` — `statSync` | 200 | `catch {}` with comment "skip unreadable files" |
| `collectConfigFiles` — `readdirSync` root | 225 | `catch {}` with comment "ignore" |

`readFileSafe` is intentionally lenient (callers expect `''` on failure) and is also called from `stack-detect.ts` with the same contract, so a debug-level log or a `// intentional` comment at minimum would satisfy the convention. The remaining four are straightforward I/O guards that should at least emit `debug`-level logs.

#### [M3] `init.ts` — `proposeAgents` is imported but never used

Line 10:
```ts
import { detectStack, proposeAgents, analyzeWorkspace } from '../utils/stack-detect.js';
```

`proposeAgents` is not referenced anywhere in `init.ts`. It was used in the previous implementation of `handleStackDetection` and was not removed after the refactor to `analyzeWorkspace`. This is a dead import.

Convention: **No unused imports or dead code.**

#### [M4] `init.ts` — `stacks` parameter in `handleStackDetection` is dead

```ts
async function handleStackDetection(
  cwd: string,
  stacks: DetectedStack[],   // ← never referenced in body
  opts: InitOptions
): Promise<string[]> {
```

The function immediately calls `analyzeWorkspace(cwd, claudeAvailable)`, which re-runs stack detection internally. The `stacks` parameter (passed from `detectedStacks` at line 472) is never used. This is a dead parameter — it misleads callers into thinking the pre-detected stacks are consumed by this function.

---

### MINOR

#### [m1] `stack-detect.ts` — `readFileSafe` is duplicated from `workspace-signals.ts`

`stack-detect.ts` lines 46–52 and `workspace-signals.ts` lines 55–62 both define `readFileSafe`. The implementations differ (workspace-signals adds a `maxBytes` parameter), but both serve the same purpose. This is not a convention violation, but it creates maintenance drift. The workspace-signals version could be exported and reused.

#### [m2] `stack-detect.ts` — Variable `raw` shadows outer function parameter `raw`

In `parseAIAnalysisResponse(raw: string)` (line 379), the `for` loop on line 405 declares a loop variable also named `raw`:

```ts
for (const raw of obj['agents'] as unknown[]) {
```

This shadows the outer `raw: string` parameter. The function is short enough that it is not dangerous, but it causes a naming collision that TypeScript will report at `strict` mode as a shadowing warning in some configurations.

#### [m3] `workspace-signals.ts` — `'.DS_Store'` in `IGNORED_DIRS` is a file, not a directory

Line 19:
```ts
'.DS_Store',
```

`IGNORED_DIRS` is used in `walkTree` to skip directory names (`IGNORED_DIRS.has(name)`). `.DS_Store` is a macOS metadata *file*, not a directory, so it will never appear as a directory entry and the entry has no effect. This is harmless but misleading. If the intent is to exclude `.DS_Store` from extension histogram counts, it should be handled in `buildExtensionHistogram` instead.

---

## Per-File Summary

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `workspace-signals.ts` | 298 | ISSUES | M1 (size), M2 (empty catches), m3 (DS_Store) |
| `stack-detect.ts` | 529 | ISSUES | C1 (6× `as` assertions), m1 (duplication), m2 (variable shadowing) |
| `agent-map.ts` | 49 | CLEAN | — |
| `init.ts` | 521 | ISSUES | M3 (unused import), M4 (dead param) |

---

## Recommended Fix Priority

1. **C1** — Remove all `as` assertions in `stack-detect.ts` (especially `parseAIAnalysisResponse`); use type guards that flow into inference
2. **M3** — Remove `proposeAgents` from the `init.ts` import
3. **M4** — Remove the `stacks` parameter from `handleStackDetection` (or use it)
4. **M2** — Add at minimum a debug log or `// intentional: returns '' on failure` comment in `readFileSafe`; log the others
5. **M1** — Track file-size refactor as a follow-on task
6. **m1/m2/m3** — Low priority; can be fixed opportunistically
