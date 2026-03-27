#!/bin/bash
# Auto-sync .claude/ edits to scaffold counterpart.
# Runs as a PostToolUse hook on Edit and Write tool calls.
# If the edited file has a counterpart in packages/cli/scaffold/.claude/,
# it is copied there automatically so the two are always in sync.

INPUT=$(cat)

# Extract file_path from tool input JSON
FILE=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
    print('')
" 2>/dev/null)

if [ -z "$FILE" ]; then exit 0; fi

# Only act on .claude/ files that are NOT already inside scaffold
if [[ "$FILE" != *"/.claude/"* ]] || [[ "$FILE" == *"/scaffold/"* ]]; then exit 0; fi

# Derive scaffold counterpart — replace first /.claude/ occurrence
SCAFFOLD=$(echo "$FILE" | sed 's|/\.claude/|/packages/cli/scaffold/.claude/|')

# Only copy if the scaffold counterpart already exists (new files must be added explicitly)
if [ -f "$SCAFFOLD" ]; then
  cp "$FILE" "$SCAFFOLD"
  echo "[scaffold-sync] $SCAFFOLD"
fi

exit 0
