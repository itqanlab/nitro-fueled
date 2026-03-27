# Logic Review — TASK_2026_050

## Score: 5/10

## The 5 Paranoid Questions

### 1. How does this fail silently?

**Checksum comparison against stale manifest after a partial prior update.** If a previous
`update` run succeeded in copying files but then crashed before writing the manifest, the
manifest still holds the old checksums. On the next run those files will compute fresh
checksums from their new (already-updated) content, which will not match the old manifest
checksums, so the files will be classified as "modified by you — skipped" instead of
"unchanged — auto-update". The user never sees an error; the command just silently under-
updates, and the manifest stays stale forever.

**`--dry-run` manifest output misleads the user.** `printResults` prints "Manifest updated
to v..." only when `!dryRun`, which is correct. But the summary line `Updated: N files`
still counts reinstalled + added + updated even in dry-run mode — those writes did not
actually happen. The count is accurate about intent, but no label distinguishes dry-run
intent from real writes, making it easy for a user to misread the output as confirmation
that files were actually changed.

**`updateManifestData` removes manifest keys that are absent from the scaffold, silently.**
If the scaffold directory is temporarily incomplete (e.g., a failed scaffold prep script
left it partially populated), `updateManifestData` will `delete manifest.coreFiles[key]`
for every key not present in the current scaffold walk. On the next run, those formerly-
tracked files become "new" and get re-added. No warning is emitted; the user has no idea
keys were pruned.

### 2. What user action causes unexpected behavior?

**Running `update` before the scaffold is fully populated.** `resolveScaffoldRoot` only
validates that `.claude/agents` exists inside the candidate path. A scaffold directory
that has an agents folder but is otherwise incomplete (missing commands, skills, etc.)
will pass the existence check and proceed. Files that should be present but are missing
will be silently absent from the walk, causing their manifest entries to be pruned (see
above).

**Running `update` on a project initialized with an older version of init.** The manifest
written by `init` records core file paths using `relative(cwd, absPath)` (POSIX-normalized
in init). The update command uses `relative(scaffoldRoot, absPath).replace(/\\/g, '/')`.
These two paths can only match if the scaffold directory structure mirrors the destination
structure one-for-one. Any file that `init` tracked by a different relative base will
never be found in `manifest.coreFiles`, so it will be treated as "new" on every update
run — adding a file that already exists, each time silently clobbering it.

**Running `update --regen` on a project with no anti-patterns-master.md in the scaffold.**
`handleRegen` calls `generateAntiPatterns` which swallows failures and returns `false`,
printing "master file not found; skipped". This is acceptable, but `handleRegen` is also
called after `writeManifest`. If the manifest write threw and the `return` was hit
(`process.exitCode = 1; return`), `handleRegen` is never reached. That is correct
behavior. However if `--regen` is combined with `--dry-run`, `handleRegen` is still
called (line 297 has no `dryRun` guard) and it **will write files** — regenerating
`anti-patterns.md` even though the user asked for no writes. This is a dry-run
containment failure.

### 3. What data makes this produce wrong results?

**A manifest `coreFiles` entry whose `checksum` field is an empty string or undefined.**
`isManifest` validates that `coreFiles` is a non-null object, but does not validate the
shape of each entry inside it. If a `CoreFileEntry` has `checksum: ""` (e.g., produced by
a buggy prior version), `currentChecksum === manifestChecksum` evaluates `"sha256:abc"
=== ""` which is `false`, so the file is classified as user-modified and skipped. No error
or warning is emitted.

**Manifest `generatedFiles` with a key that is also present in `coreFiles`.** Nothing in
the data model prevents the same `relPath` appearing in both `manifest.coreFiles` and
`manifest.generatedFiles`. In `processScaffoldFiles`, generated-file membership is checked
first (`relPath in manifest.generatedFiles`) and triggers a `continue`. So a file that
appears in both records will always be treated as generated and skipped, even if the
user's intent via init was for it to be a core file. The condition is silently satisfied
for the wrong reason.

**A scaffold file whose path, when made relative to `scaffoldRoot`, produces an empty
string.** This would happen only if `scaffoldRoot` itself were a file rather than a
directory, but the existence check in `resolveScaffoldRoot` only verifies that
`.claude/agents` exists inside it. If somehow the walk is called with a file path
rather than a directory path, `readdirSync` throws, which is caught at the call site in
`update.ts` — so this fails loud rather than silently.

### 4. What happens when dependencies fail?

**`computeChecksum` throws inside `getCurrentChecksum`.** The catch in `getCurrentChecksum`
returns `null`. Then `currentChecksum === manifestChecksum` becomes `null ===
"sha256:abc"` which is `false`. The file is classified as user-modified and skipped, with
no message to the user. A read error on a project file (permissions, disk issue) looks
identical to "user modified this file". Silent wrong classification.

**`buildCoreFileEntry` (which calls `computeChecksum`) throws inside
`updateManifestData`.** There is no try/catch around the loop in `updateManifestData`.
If a file was just copied but cannot be checksummed (e.g., the copy succeeded but
immediately became unreadable), the exception propagates up through the `action` callback.
Commander catches it and prints a raw stack trace. `writeManifest` is never called so
the manifest is not updated, but `process.exitCode` is never set to 1 either — the
command exits 0 on an uncaught throw in newer versions of Commander that handle async
errors internally. At minimum this produces a confusing stack trace; at worst it exits 0
with partial state.

**`writeManifest` does not use write-to-temp + rename.** Per the `review-lessons` rule
(Disk Persistence section): `writeFileSync` truncates the target before writing. A
SIGKILL during the write leaves a zero-length `manifest.json`. On the next invocation
`readManifest` parses an empty file, `JSON.parse("")` throws, the warning is emitted, and
`null` is returned — causing `update` to abort with "run init first". The user loses their
entire manifest and must re-run `init`.

**`generateAntiPatterns` in `handleRegen` writes a file while `--dry-run` is active.**
(See question 2 above.) There is no coordination between `handleRegen` and the `dryRun`
flag. Anti-patterns regeneration writes to disk unconditionally.

### 5. What's missing that the requirements didn't mention?

**No idempotency guarantee for partial runs.** If the command is interrupted midway
(SIGKILL, OOM, Ctrl-C) after some files have been copied but before `writeManifest`
completes, the on-disk files and the manifest are out of sync. The next run will
misclassify some files as user-modified because their new checksums won't match the old
manifest entries. There is no recovery path.

**No `--show-diff` implementation despite being advertised in command output.** For every
skipped file, the command prints `→ run with --show-diff to review changes`. This flag is
not registered on the Commander command definition. Invoking `npx nitro-fueled update
--show-diff` will cause Commander to error with "unknown option". This is dead advice in
the output pointing to a non-existent feature.

**No "nothing changed" early exit.** If current version equals manifest version and all
files are unchanged, the command still walks the entire scaffold, runs the comparison
loop, and writes an updated manifest (with the same timestamp). The user sees a wall of
`✓ auto-updated (unchanged)` lines with no indication that everything was already current.

**`-y / --yes` flag is accepted but never used.** `UpdateOptions.yes` is parsed but never
read. The task description says `-y` should "accept all auto-updates, skip modified files
without prompting." Currently the command already does this unconditionally (no interactive
prompts exist). So `-y` is both always-true behavior by default and an unread option.

**Version comparison is absent.** The command prints `Current version` and `Latest
version` but never compares them. If `latestVersion === manifest.version`, the update
proceeds anyway. There is no fast-path "already up to date" message, and no warning if
`latestVersion` is older than `manifest.version` (which can happen in a downgrade
scenario).

---

## Findings

### Critical (must fix)

**1. `--dry-run` does not prevent file writes in `--regen` path**

`handleRegen` is invoked unconditionally when `opts.regen` is `true`, regardless of
`opts.dryRun`. It calls `generateAntiPatterns(cwd, stacks, scaffoldRoot)` which writes
`.claude/anti-patterns.md` to disk. A user running `--dry-run --regen` will have their
anti-patterns file overwritten.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/update.ts`, lines
296-299.

The guard on line 296 is `if (opts.regen)` with no `&& !opts.dryRun` check.

**2. `updateManifestData` has no error handling — uncaught throw exits 0 with partial
state**

The loop at lines 126-131 calls `buildCoreFileEntry(destPath, latestVersion)` which
internally calls `computeChecksum` which can throw. There is no try/catch around this
loop. An exception propagates to the `action` async callback. Commander wraps the action
in a catch that calls `program.error()` or rethrows; in either case `process.exitCode`
is not guaranteed to be 1 and the manifest is left unwritten, creating split brain.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/update.ts`, lines
114-140.

**3. `--show-diff` is advertised in output but not implemented as a CLI flag**

Every skipped file prints `→ run with --show-diff to review changes` (line 167 of
update.ts). The flag is not registered with Commander. Running `update --show-diff` will
produce a Commander "unknown option" error. This is a broken UX promise present in every
execution of the command.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/update.ts`, line
167.

**4. `writeManifest` uses `writeFileSync` without atomic rename**

Per the review-lessons rule on disk persistence: `writeFileSync` truncates then writes. A
crash mid-write leaves a corrupt `manifest.json` that cannot be parsed, destroying the
entire update state. The manifest is the central source of truth for safe updates; its
corruption forces a full `init` re-run.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/manifest.ts`, lines
62-71.

### Major (should fix)

**5. `getCurrentChecksum` returns `null` on read error, silently classifying the file as
user-modified**

If `computeChecksum` throws (permissions error, disk fault), `getCurrentChecksum` returns
`null`. The comparison `null === manifestChecksum` is `false`, so the file is logged as
"modified by you — skipped". The user has no idea the classification is wrong; they see a
skipped file with no error message. A disk error is indistinguishable from a user edit.

Fix: detect the `null` case explicitly and emit a warning, classifying the file as
`'error'` or aborting the operation.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/update.ts`, lines
58-65 and 101-108.

**6. `-y / --yes` flag is parsed but never used**

`UpdateOptions.yes` is declared and populated by Commander (line 226) but never read
anywhere in the implementation. This is dead option surface that misleads users reading
the help text. It also means there is no behavioral difference between running with and
without `-y`.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/update.ts`.

**7. No version comparison — proceeds even when already up to date**

`latestVersion` and `manifest.version` are both read and printed, but never compared.
The command performs the full scaffold walk and writes a new manifest timestamp even when
`latestVersion === manifest.version`. There is no "already up to date" short-circuit. In
a downgrade scenario (`latestVersion < manifest.version`), the command proceeds silently
and downgrades files without warning.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/update.ts`, lines
256-264.

**8. Stale manifest after interrupted prior run causes permanent misclassification**

If a previous `update` copied files then crashed before writing the manifest, the manifest
checksums are stale. On the next run, those files compute new checksums that don't match
the stale manifest entries, so they are classified as "modified by you — skipped". The
user must manually `--overwrite` or delete the manifest and re-run `init` to recover. No
warning or recovery path exists.

**9. `resolveScaffoldRoot` validates only `.claude/agents` exists, allowing partial
scaffolds through**

The probe condition is `existsSync(resolve(packageScaffold, '.claude', 'agents'))`. A
scaffold directory that has the agents folder but is otherwise empty (missing commands,
skills, review-lessons, etc.) passes the check. The subsequent walk returns a sparse file
set, causing `updateManifestData` to prune manifest keys for all missing files, silently
corrupting the manifest.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/scaffold.ts`, lines
12-30.

### Minor (nice to have)

**10. Dry-run summary counts imply writes happened**

In dry-run mode, `Updated: N files` appears without a modifier that makes it clear these
are projected counts, not completed writes. The `[dry-run]` suffix is added to each
per-file line, but the aggregate summary lines (Updated, New files added) have no
dry-run annotation.

**11. `getPackageVersion` is duplicated between `init.ts` and `update.ts`**

Identical function defined twice. Should be extracted to a shared utility.

**12. `ensureParentDir` uses `existsSync` + `mkdirSync` non-atomically**

If two concurrent `update` invocations run simultaneously (unlikely but possible), the
`existsSync` → `mkdirSync` sequence has a TOCTOU window. `mkdirSync` with
`{ recursive: true }` is idempotent and should be called unconditionally, removing
the need for the `existsSync` check.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/commands/update.ts`, lines
45-50.

**13. `printResults` says "Manifest updated to v..." even when zero files changed**

This message is printed any time `!dryRun`, regardless of whether the manifest actually
changed. If no files were updated, added, or reinstalled, the manifest is still written
with an updated `updatedAt` timestamp. The message is technically accurate but misleading.

---

## Acceptance Criteria Check

| Criteria | Met? | Notes |
|----------|------|-------|
| `npx nitro-fueled update` runs without error | PARTIAL | Runs, but `--show-diff` advertised in output does not exist as a flag; will error if user follows the advice |
| Unchanged core files are auto-updated silently | YES | Correct checksum comparison, correct copy |
| Modified core files are reported and skipped | YES | Correct; but classification is wrong on read errors (silent mismatch) |
| `--dry-run` shows plan without writing any files | NO | `--regen --dry-run` still writes anti-patterns.md |
| `--regen` triggers re-run of AI workspace analysis and anti-patterns generation | PARTIAL | Anti-patterns regenerated; AI agents are listed but not actually regenerated (acknowledged in output, but task spec says "triggers re-run") |
| Manifest is updated to new version after successful update | YES | Correct; but not atomic (crash during write corrupts manifest) |
| New files introduced in the new version are added automatically | YES | Correct |
| Generated files are never touched by default | YES | Correct skip logic |
| TypeScript compiles cleanly | UNKNOWN | Not verified in this review; no compile errors visible in code structure |

---

## Data Flow Analysis

```
update command action()
  │
  ├─ readManifest(cwd)                        [manifest.ts]
  │    RISK: corrupt JSON → null → abort OK
  │    RISK: partial/stale manifest from prior interrupted run → silent misclassification
  │
  ├─ resolveScaffoldRoot()                    [scaffold.ts]
  │    RISK: only checks .claude/agents exists; sparse scaffold passes through
  │
  ├─ getPackageVersion()                      [local]
  │    RISK: always returns string; 0.0.0 fallback accepted silently
  │    RISK: no comparison against manifest.version performed
  │
  ├─ walkScaffoldFiles(scaffoldRoot)          [scaffold.ts]
  │    SAFE: symlinks skipped; errors caught at call site
  │
  ├─ processScaffoldFiles(...)                [local]
  │    RISK: getCurrentChecksum returns null on error → silent "skipped" misclassification
  │    RISK: generatedFiles + coreFiles overlap: generated wins silently
  │    OK:  dryRun propagated correctly here
  │
  ├─ printResults(...)                        [local]
  │    RISK: --show-diff advertised but flag not registered
  │    RISK: dry-run aggregate counts not annotated
  │
  ├─ updateManifestData(...)   [only if !dryRun]
  │    RISK: buildCoreFileEntry can throw; no try/catch; exits 0 with no manifest written
  │    RISK: prunes manifest keys silently when scaffold is incomplete
  │
  ├─ writeManifest(cwd, manifest) [only if !dryRun]
  │    RISK: writeFileSync is not atomic; crash mid-write = corrupt manifest.json
  │
  └─ handleRegen(...)          [if opts.regen — NO dryRun guard]
       RISK: writes anti-patterns.md even when --dry-run is set
```

---

## Summary

The core update algorithm (unchanged → copy, modified → skip, new → add, deleted →
reinstall) is structurally correct. The checksum comparison logic is sound under normal
conditions. The manifest is read and written in the right order, generated files are
correctly excluded, and the command registers cleanly in `index.ts`.

The problems are in failure handling and edge cases: the dry-run containment bug with
`--regen` is a clear spec violation; the advertised `--show-diff` flag that doesn't exist
will confuse every user who tries to follow the output instructions; the non-atomic
manifest write is a known data-loss vector from the review lessons that wasn't applied
here; `updateManifestData` has an unguarded throw path; and `-y` is dead option surface.

The happy path works. The failure paths have multiple gaps that range from confusing UX
to silent data corruption.
