# Style Review — TASK_2026_031

## Score: 6/10

---

## Findings

### [MAJOR] `init.ts` exceeds the 200-line service file limit — by 2x

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/init.ts` (403 lines)

The review-general.md file-size rule caps command/handler files at 150 lines (component equivalent) or 200 lines (service equivalent). At 403 lines this file was already over the limit before this task added `commitScaffold()` and the `--commit` wiring. The new function is 37 lines and the action handler now has 9 distinct steps.

The file hosts at least four separable concerns: git operations (`commitScaffold`), agent generation (`generateAgent`, `handleStackDetection`), MCP configuration (`handleMcpConfig`), and the top-level orchestration action. `commitScaffold` in particular has no dependency on commander or any other init concept — it belongs in a `git.ts` utility alongside its own unit-testable surface.

**Fix**: Extract `commitScaffold` to `packages/cli/src/utils/git.ts`. Consider a second extraction pass (`agent-generation.ts`, `mcp-setup.ts`) to bring the main command file under 150 lines.

---

### [MAJOR] Non-sequential step numbering in inline comments

**File**: `init.ts`, lines 363 and 387

The action handler uses comment labels `// Step 5b` and `// Step 6b` for the gitignore and agent-generation steps. The review-general lesson (TASK_2026_043) explicitly calls this out:

> Step numbering in command docs must be flat and sequential — using mixed schemes (Step 5, Step 5b, Step 5c) signals to future contributors that insertions should continue the sub-letter pattern rather than renumber.

The actual numbered steps run: 1, 2, 3, 4, 5, 5b, 6, 6b, 7, 8, 9. Any contributor inserting a new step after "Step 5" will model it as "Step 5c".

**Fix**: Renumber all steps flat and sequential (1 through 9 → 1 through 11, or fold the sub-steps into their parent with a descriptive comment instead of a numeric label).

---

### [MAJOR] `InitOptions` interface defined inside the command file, not in a model file

**File**: `init.ts`, lines 16-23

The review-general rule states "One interface/type per file — don't define models inside component files. Move to `*.model.ts`." `InitOptions` is a named interface with 6 fields; it defines the contract for the command's flag surface and will need updating whenever a new option is added.

Keeping it co-located with 400 lines of implementation logic means a reader scanning for the type shape must hunt through the file rather than finding it in `init.model.ts` or `commands/init/types.ts`.

**Fix**: Move `InitOptions` to `src/commands/init.model.ts` (or `src/commands/init/types.ts`) and import it.

---

### [MINOR] Inline `map` expression in template literal breaks readability

**File**: `init.ts`, lines 381-384

```typescript
console.log(`  Detected: ${detectedStacks.map((s) => {
  if (s.frameworks.length > 0) return `${s.language} (${s.frameworks.join(', ')})`;
  return s.language;
}).join(', ')}`);
```

A multi-line arrow function embedded inside a template literal is hard to scan at a glance. The expression should be extracted to a local variable (or a named helper) before the `console.log` call. This is the same class of issue as "no complex expressions in templates — use `computed()`" from the Angular rules; the underlying principle applies here too.

**Fix**: Extract to `const detectedLabel = detectedStacks.map(...).join(', ')` above the `console.log`.

---

### [MINOR] Duplicate `existsSync` / `spawnSync` imports between `init.ts` and the new `commitScaffold` function

**File**: `init.ts`, line 1

`existsSync` is imported for use in both the existing init logic and the new `commitScaffold`. This is not a bug — it is a smell that supports the extraction recommendation above. Once `commitScaffold` moves to `git.ts`, `init.ts` can remove `existsSync` from its own import if no other usage remains, or the imports become clearly split by concern.

This is a tracking note, not a blocker; it resolves automatically if the MAJOR extraction finding is addressed.

---

### [MINOR] `scaffold.ts` — `files` field JSDoc comment is adequate but inconsistent in style

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/scaffold.ts`, lines 34-38

The new `files` field has a JSDoc comment (`/** Absolute destination paths ... */`) while the three sibling fields (`copied`, `skipped`, `dirs`) have no comments at all. Either document all four or none. Selective documentation implies the documented field has special handling that needs calling out — which it does in this case — but the inconsistency will confuse readers who expect all fields to be equally explained.

**Fix**: Add one-line comments to `copied`, `skipped`, `dirs`, or remove the inline comment from `files` and rely on the interface-level JSDoc.

---

## Approved

- **`scaffold.ts` changes are minimal and well-scoped.** Adding `files: string[]` to `CopyResult` and the `result.files.push(destPath)` call is exactly the right place; the mutation is local and the recursive merge (`result.files.push(...sub.files)`) is correct.
- **`commitScaffold` function does not use `any` types** and has no type assertions. All error path returns are explicit.
- **`--commit` flag registration** follows the exact pattern of every other flag in the `.option()` chain — consistent placement, correct default (`false`), matching field in `InitOptions`.
- **`commitScaffold` error handling is non-swallowing.** Every failure branch (`files.length === 0`, no `.git`, `add` failure, `commit` failure) emits a message before returning. No empty catch blocks.
- **File tracking in `scaffoldFiles`** is cleanly done — each call site pushes to `createdFiles` immediately after the copy call, making the flow easy to audit.
- **Step 5 / Step 8 CLAUDE.md and gitignore tracking** correctly use the pre/post `existsSync` pattern to avoid tracking files that already existed, satisfying the "only files created by init" acceptance criterion.
