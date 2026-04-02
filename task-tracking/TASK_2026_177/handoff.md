# Handoff — TASK_2026_177

## Files Changed
- scripts/check-scaffold-sync.sh (new, 68 lines)
- .githooks/pre-commit (new, 7 lines)
- .github/workflows/scaffold-sync.yml (new, 22 lines)
- package.json (modified, +1 prepare script)
- apps/cli/scaffold/.claude/review-lessons/backend.md (synced to source)
- apps/cli/scaffold/.claude/review-lessons/frontend.md (synced to source)
- apps/cli/scaffold/.claude/review-lessons/security.md (synced to source)
- apps/cli/scaffold/.claude/settings.json (synced to source)
- apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md (synced to source)

## Commits
- Implementation commit (see below)

## Decisions
- Used `.githooks/` directory with `git config core.hooksPath` (set via `npm prepare`) instead of husky to avoid adding a new dependency
- `--staged` mode for pre-commit hook: only checks .claude/ files that are actually staged, skips hook if none are staged (fast path)
- Full mode (no flags) for CI: checks every file in source against scaffold
- Excluded `.claude/hooks/`, `.claude/worktrees/`, `.claude/settings.local.json` from sync check — these are local-only and not part of the scaffold

## Known Risks
- The `prepare` script sets hooksPath globally for the repo clone; developers who run `npm install` will get the hook automatically, but the hook is not retroactively installed for existing clones without running `npm install` or `git config core.hooksPath .githooks` manually
- The existing `sync-scaffold.sh` Claude hook references `packages/cli/scaffold/.claude/` (wrong path — should be `apps/cli/scaffold/.claude/`) — this is a pre-existing bug, not addressed here
