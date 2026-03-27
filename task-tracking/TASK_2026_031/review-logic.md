# Logic Review — TASK_2026_031

## Score: 6/10

## Summary

| Metric              | Value          |
| ------------------- | -------------- |
| Overall Score       | 6/10           |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 2              |
| Serious Issues      | 2              |
| Moderate Issues     | 2              |
| Failure Modes Found | 6              |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `.gitignore` modification is the clearest silent failure. When `.gitignore` already existed before `init`, `ensureGitignore` appends to it — that write happens — but `init.ts` only adds `gitignorePath` to `allCreatedFiles` when the file did **not** previously exist (`!gitignoreExisted`). So a user running `--commit` in a project that already has a `.gitignore` will never stage the updated `.gitignore`. The entry gets written to disk, but the file is silently omitted from the commit. Git will show the file as modified but unstaged, with no error or warning from the CLI.

The same logic flaw applies to CLAUDE.md: `allCreatedFiles` only captures it when `!claudeMdExisted || opts.overwrite`. If `generateClaudeMd` returns false (write error), the path is still pushed to `allCreatedFiles` — but the file does not exist on disk — so `git add` will receive a non-existent path. Git will emit a path-spec error on stderr. That error is caught and printed but `commitScaffold` returns immediately, leaving the user with no commit and no clear explanation of which file was the problem.

### 2. What user action causes unexpected behavior?

A user running `init --commit` in a project that already has **pre-existing uncommitted changes** will get those changes staged alongside the scaffolded files IF any of the scaffold files overlap (same path) with already-modified files. The requirement says "only files created by init are staged — not pre-existing uncommitted changes". The implementation uses `git add -- <explicit file list>` which is correct for preventing stray unstaged files from being swept in. However, if a scaffold file happens to match a path the user already has modified and uncommitted (e.g., the user had a partial `CLAUDE.md` that init just overwrote with `--overwrite`), the old content is now gone. The commit captures the overwritten version. This is arguably intentional under `--overwrite`, but it is not called out anywhere in comments or error output.

### 3. What data makes this produce wrong results?

File paths with spaces or special characters are passed directly as individual arguments in the `git add` spread: `['add', '--', ...files]`. Node's `spawnSync` with an array argv does not invoke a shell, so spaces in paths are safe. This is correctly implemented.

However, the file list is built from absolute paths. If `cwd` is on a different drive or mount point than the repo root (edge case on Windows or certain Linux mount setups), absolute paths passed to `git add` inside a repo subdirectory may be misinterpreted. In practice this is not a macOS/Linux issue, but it is worth noting that relative paths (relative to `cwd`) would be more portable and explicit.

### 4. What happens when dependencies fail?

- `git add` succeeds but `git commit` fails (e.g., a pre-commit hook rejects the commit, no user identity configured). The files are now **staged but not committed**. `commitScaffold` returns after printing the stderr. On the next `git status`, the user sees staged changes they did not intentionally create. There is no rollback (`git reset HEAD`) performed. This is a leftover staged state with no guidance to the user on how to proceed.

- `git add` fails mid-way (partial path list causes an error): all files up to the failing one may be staged or none may be staged — depending on git internals. The error is caught and printed, but no cleanup is performed.

- The `.git` check uses `existsSync(resolve(cwd, '.git'))`. This passes for a standard git repo, but fails for git worktrees, where `.git` is a file (not a directory) containing a `gitdir:` pointer. A user in a git worktree will see "git is not initialized in this directory" even though it is. This is a concrete bug for monorepo users who work inside worktrees.

### 5. What's missing that the requirements didn't mention?

- **No process.exitCode = 1 on commit failure**: Every other failure path in `init.ts` sets `process.exitCode = 1`. `commitScaffold` only logs and returns. A CI pipeline running `nitro-fueled init --commit` will exit 0 even when the commit fails, making the failure invisible to automation.

- **No mention of generated developer agents**: `handleStackDetection` calls `generateAgent()` which can write files via Claude CLI. Those generated agent files are never added to `allCreatedFiles`. The task description says "all scaffolded files", and a user who runs `init --commit` expecting a clean repo afterward will see the generated agent `.md` files left as untracked.

- **The `anti-patterns.md` tracking gap**: `handleAntiPatterns` is called, the file is potentially written, but the tracking code only appends `apPath` to `allCreatedFiles` when the path did not exist before OR overwrite is set AND the file now exists. If `generateAntiPatterns` returns false (master file not found, line 139), `existsSync(apPath)` is false, so the path is not added. That is correct. However, if the file pre-existed and was NOT regenerated (the early-return path at line 131), it is correctly excluded. This part is actually fine.

---

## Findings

### [CRITICAL] `.gitignore` modifications not tracked when file pre-existed

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/init.ts` lines 364-369

When `.gitignore` already exists and `ensureGitignore` appends the `.nitro-fueled/` entry, the file is **modified on disk** but never added to `allCreatedFiles`. The guard `if (!gitignoreExisted)` excludes it unconditionally when the file pre-existed, regardless of whether content was actually appended.

The requirement states "only files created by init are staged". A modified `.gitignore` is not a file created by init, but a file changed by init. Whether it should be included in the commit is debatable — but the current behavior silently leaves a modified `.gitignore` unstaged with no user notice. At minimum, users should be informed: "Note: .gitignore was updated but not staged (pre-existing file)."

The more correct behavior for a `--commit` flag is to stage the `.gitignore` whenever init modified it, since the modification is part of the init operation. The `ensureGitignore` function has no return value indicating whether it actually made a change; that information is lost.

**Fix**: Either make `ensureGitignore` return a boolean indicating whether it wrote anything (and track accordingly), or always stage the `.gitignore` if it was touched by init.

---

### [CRITICAL] Staged-but-not-committed state on pre-commit hook failure; no exit code on commit failure

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/init.ts` lines 258-265, and the missing `process.exitCode = 1`

When `git add` succeeds but `git commit` fails (pre-commit hook rejection, missing git identity, gpg signing failure), the implementation logs the error and returns. The files remain staged. The user's working tree is now in a partially-modified state they did not consciously create.

Additionally, every other failure in the `action` handler sets `process.exitCode = 1`. `commitScaffold` sets no exit code. A CI runner will exit 0 on commit failure.

**Fix 1**: After a failed `git commit`, run `spawnSync('git', ['reset', 'HEAD', '--', ...files], { cwd })` to unstage the files.
**Fix 2**: Thread exit-code control through `commitScaffold` (return a boolean) and set `process.exitCode = 1` in the caller on failure.

---

### [SERIOUS] Git worktree support broken

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/init.ts` line 236

```typescript
if (!existsSync(resolve(cwd, '.git'))) {
```

In a git worktree, `.git` is a **file**, not a directory, containing `gitdir: /path/to/main/.git/worktrees/name`. `existsSync` returns true for a file, so this particular check actually passes for worktrees — that part is fine.

However, the check only looks in `cwd`. If `init` is run in a subdirectory of a repo (e.g., `packages/my-app/`), `.git` does not exist there; it exists at the repo root. The user gets: "git is not initialized in this directory. Run `git init` first." — even though git is initialized. This is the standard monorepo layout where `init` is run in a package subdirectory.

**Fix**: Use `spawnSync('git', ['rev-parse', '--git-dir'], { cwd })` and check `status === 0` instead of checking for a `.git` file. This handles worktrees, subdirectories, and all other git repo layouts.

---

### [SERIOUS] Generated developer agents not tracked in `allCreatedFiles`

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/init.ts` lines 388, `generateAgent()` function

`handleStackDetection` → `generateAgent()` writes agent `.md` files via the Claude CLI. These files are created as part of init but are never appended to `allCreatedFiles`. A user running `init --commit` who accepts the agent generation prompt will end up with generated agent files as untracked leftovers after the commit. The acceptance criterion "stages and commits all scaffolded files" is only partially met.

This is a structural gap: `handleStackDetection` is `async void` and has no return value, so there is no mechanism to collect the paths it creates. The generated files are written at non-deterministic paths (`.claude/agents/<name>.md`) but the names are known from `proposals`.

**Fix**: Refactor `handleStackDetection` to return `string[]` of successfully generated agent paths, and append those to `allCreatedFiles` before calling `commitScaffold`.

---

### [MODERATE] `CLAUDE.md` tracked before verifying the write succeeded

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/init.ts` lines 357-361

```typescript
generateClaudeMd(cwd, opts.overwrite);
if ((!claudeMdExisted || opts.overwrite) && existsSync(claudeMdPath)) {
  allCreatedFiles.push(claudeMdPath);
}
```

This double-checks with `existsSync` after the write, which is correct. But `generateClaudeMd` returns `false` on write failure and logs an error — the caller does not check the return value. The `existsSync` guard prevents adding the path when the write failed, so the logic is incidentally safe, but the write failure is not surfaced to the caller as an error that should abort `--commit`. The commit proceeds with a partial set of files.

**Fix**: Check `generateClaudeMd`'s return value and bail (with `process.exitCode = 1`) when the write fails, rather than silently proceeding to commit.

---

### [MODERATE] `commitScaffold` called with absolute paths — argument list may be very large

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/init.ts` line 241

`git add -- ...files` spreads up to 56+ absolute paths as individual CLI arguments. On most systems the argument limit (`ARG_MAX`) is 256KB+, so 56 paths will never hit it. This is not a practical problem in this use case, but it is worth noting: if the file list ever grows into the hundreds (e.g., projects with many custom skills), using `git add -A -- .` restricted to a known prefix, or writing paths to a temp file and using `git add --pathspec-from-file`, would be more robust.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| `init --commit` stages and commits all scaffolded files | PARTIAL | Generated agent files are not tracked; modified (pre-existing) .gitignore is not staged |
| Commit message is `chore: initialize nitro-fueled orchestration` | COMPLETE | Hardcoded correctly |
| Only files created by init are staged | COMPLETE | `git add -- <explicit list>` correctly limits staging scope |
| `init` without flag behavior unchanged | COMPLETE | Flag check gates all commit logic |
| If git is not initialized, show error | PARTIAL | Works for standard repos; broken for subdirectories of a repo (see worktree/subdirectory finding) |

### Implicit Requirements NOT Addressed

1. **Exit code propagation**: CI usage of `init --commit` will silently exit 0 on commit failure.
2. **Rollback on partial failure**: Staged-but-uncommitted state after hook failure leaves repo in unexpected state.
3. **User notification when modified files are not staged**: The `.gitignore` is updated but not staged with no user-visible explanation.

---

## Approved

- The core mechanism — tracking absolute paths in `CopyResult.files` and spreading them into `git add --` — is the right approach and correctly prevents staging pre-existing uncommitted changes.
- Symlink skipping in `copyDirRecursive` (line 66) prevents symlink-following issues.
- Error output from `git add` and `git commit` is captured from stderr and printed — not swallowed.
- The guard for empty file list (`files.length === 0`) correctly short-circuits with a useful message.
- The `.git` check happens inside `commitScaffold` (not in the caller), so the function is self-contained.
- `spawnSync` with array argv avoids shell injection for file paths.
