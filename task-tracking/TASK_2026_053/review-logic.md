# Logic Review — TASK_2026_053

## Score: 5/10

## Summary

The core intent was delivered: CLAUDE.md now describes the package-as-library model, the landing page has an Install section and a "How It Stays Current" section, all agent names use the `nitro-*` prefix, and plan.md has Phase 12. However, four factual errors were introduced or left unresolved — two of which are hard misinformation visible to any reader of the landing page.

---

## Critical Issues (must fix)

### 1. `nitro-manifest.json` is the wrong filename — `index.html:982`

The "How It Stays Current" section names the file `nitro-manifest.json`. The actual CLI writes the manifest to `.nitro-fueled/manifest.json` (a directory, not a root-level file). Confirmed in:

- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/src/utils/manifest.ts` line 41: `resolve(cwd, '.nitro-fueled', 'manifest.json')`

A developer following the landing page to locate or inspect the manifest will look in the wrong place. The control-file label at line 982 and the description at line 984 must both be updated to `.nitro-fueled/manifest.json`.

### 2. Commands count is wrong: landing page says 15, actual count is 17 — `index.html:44, 1013`

The hero stat card and the footer both claim "15 commands". Counting `.claude/commands/` on disk returns 17 files:

```
auto-pilot, create, create-agent, create-skill, create-task, evaluate-agent,
initialize-workspace, orchestrate, orchestrate-help, plan, project-status,
retrospective, review-code, review-logic, review-security, run, status
```

The Commands section of the landing page lists `/retrospective` and `/evaluate-agent` nowhere — both are missing from the grid entirely. The stats are wrong and two shipped commands are invisible in the documentation. Both the stat and the grid need updating.

---

## Minor Issues (should fix)

### 3. Phase ordering in `plan.md` — Phase 10 appears after Phase 11

In `task-tracking/plan.md`, the phase headings appear in this order:

```
Phase 1 ... Phase 9, Phase 11, Phase 10, Phase 12
```

Phase 10 (Agent Calibration) is rendered after Phase 11 (Supervisor Reliability). This is purely a document ordering problem — the content of each phase is internally correct — but it causes confusion for any reader scanning the roadmap top-to-bottom. Phase 10 should be reordered to appear before Phase 11.

### 4. `CLAUDE.md` still marks `packages/` as `(TBD)` — `CLAUDE.md:26`

The project structure comment reads:

```
packages/                  # (TBD) Nx workspace packages
```

The packages directory is fully built and contains `cli/`, `dashboard-service/`, `dashboard-web/`, and `session-orchestrator/`. The `(TBD)` label is implementation-era language that should have been removed before merge (see review-general.md: "Implementation-era language must be removed before merge"). It now permanently misleads contributors into thinking this directory is aspirational.

### 5. `docs/nitro-fueled-design.md` architecture diagram is stale — line 19

The design doc's workspace tree shows:

```
  scaffold/                    # (TBD) What gets copied into target projects
```

as a top-level sibling of `packages/cli/`. In reality the scaffold lives at `packages/cli/scaffold/` — there is no top-level `scaffold/` directory. The `(TBD)` note is also implementation-era language on a path that does not exist. The task description says "review and update if stale" — this was not done.

---

## Suggestions (optional)

- The CLAUDE.md commands list at line 22 (`# /orchestrate, /plan, /auto-pilot, /review-*, /create-task, /initialize-workspace, /project-status, /orchestrate-help`) omits the newer commands `/run`, `/create`, `/status`, `/retrospective`, and `/evaluate-agent`. The list was not updated as part of this task. It should either be updated or changed to `/orchestrate, /plan, /auto-pilot, ...` with a note that the full list is in `.claude/commands/`.

- The design doc's core agent list at lines 44-49 omits `nitro-ui-ux-designer` even though that file ships in the scaffold. The list counts 19 nitro-* agents; the actual scaffold has 22. If the design doc list is intended as canonical, it needs 3 more entries.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Landing page has an "Install" section with init → plan → run flow | COMPLETE | None |
| Landing page uses `nitro-*` agent names throughout | COMPLETE | None |
| Landing page has a section explaining the manifest-based update model | COMPLETE | Manifest filename is wrong (`nitro-manifest.json` vs `.nitro-fueled/manifest.json`) |
| `CLAUDE.md` accurately describes the package-as-library-tested-on-itself model | COMPLETE | `packages/ # (TBD)` is stale |
| `CLAUDE.md` documents the `nitro-*` naming convention | COMPLETE | None |
| `task-tracking/plan.md` has a new CLI Maturity phase with tasks 049-053 | COMPLETE | Phase ordering (10 after 11) |
| No remaining references to old agent names (non-prefixed) in docs | COMPLETE | None found |
