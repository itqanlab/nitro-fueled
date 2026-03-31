# Context — TASK_2026_177

## User Intent

Add a pre-commit hook and CI check that detects when `.claude/` files are modified but the corresponding `apps/cli/scaffold/.claude/` copies are not updated in the same commit.

## Strategy

DEVOPS — Simple complexity. Direct implementation:
1. `scripts/check-scaffold-sync.sh` — checksum comparison script
2. `.githooks/pre-commit` — git hook entry point
3. `.github/workflows/scaffold-sync.yml` — CI check
4. `package.json` prepare script — auto-configure hooksPath on `npm install`

## Background

Divergence between source `.claude/` and scaffold was found in 4 task reviews (122, 129, 137, 154) — each time acknowledged as "pre-existing" but never fixed systematically.

## Key Paths

- Source: `.claude/`
- Target scaffold: `apps/cli/scaffold/.claude/`
- Script: `scripts/check-scaffold-sync.sh`
- Git hook: `.githooks/pre-commit`
- CI: `.github/workflows/scaffold-sync.yml`
