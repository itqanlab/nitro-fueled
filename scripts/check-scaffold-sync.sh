#!/bin/bash
# check-scaffold-sync.sh — Verifies .claude/ and apps/cli/scaffold/.claude/ are in sync.
#
# Usage:
#   ./scripts/check-scaffold-sync.sh           # Check ALL files (for CI)
#   ./scripts/check-scaffold-sync.sh --staged  # Only staged .claude/ files (for pre-commit)
#
# Exit codes:
#   0 — in sync (or no relevant staged files)
#   1 — divergence found; lists out-of-sync files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE="$ROOT/.claude"
SCAFFOLD="$ROOT/apps/cli/scaffold/.claude"

# Files/dirs to exclude — local-only, not shipped in scaffold
EXCLUDE_PATTERNS=(
  ".claude/hooks/"
  ".claude/worktrees/"
  ".claude/settings.local.json"
)

STAGED_ONLY=false
if [[ "${1:-}" == "--staged" ]]; then
  STAGED_ONLY=true
fi

errors=()

should_exclude() {
  local file="$1"
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$file" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

check_file() {
  local src="$1"
  local rel="${src#"$SOURCE/"}"
  local scaffold_file="$SCAFFOLD/$rel"

  if should_exclude ".claude/$rel"; then
    return 0
  fi

  if [ ! -f "$scaffold_file" ]; then
    errors+=("MISSING from scaffold: apps/cli/scaffold/.claude/$rel")
    return
  fi

  if ! diff -q "$src" "$scaffold_file" > /dev/null 2>&1; then
    errors+=("CONTENT MISMATCH: .claude/$rel")
  fi
}

if $STAGED_ONLY; then
  # Collect staged .claude/ files (added, copied, or modified)
  staged_files=$(git -C "$ROOT" diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep "^\.claude/" || true)

  if [ -z "$staged_files" ]; then
    exit 0  # No .claude/ files staged — nothing to check
  fi

  while IFS= read -r rel_file; do
    rel="${rel_file#.claude/}"
    src="$SOURCE/$rel"
    if [ -f "$src" ]; then
      check_file "$src"
    fi
  done <<< "$staged_files"
else
  # Full check — compare every file in source against scaffold
  while IFS= read -r src; do
    check_file "$src"
  done < <(find "$SOURCE" -type f | sort)
fi

if [ ${#errors[@]} -gt 0 ]; then
  echo ""
  echo "ERROR: .claude/ and apps/cli/scaffold/.claude/ are out of sync!"
  echo ""
  for err in "${errors[@]}"; do
    echo "  - $err"
  done
  echo ""
  echo "To fix, copy the updated file(s) to the scaffold:"
  echo "  cp .claude/<file> apps/cli/scaffold/.claude/<file>"
  echo ""
  echo "Then re-stage the scaffold copy before committing."
  echo ""
  exit 1
fi

echo "scaffold-sync: OK"
exit 0
