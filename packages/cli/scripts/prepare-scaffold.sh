#!/usr/bin/env bash
# Copies core agents, skills, and commands from the repo root into packages/cli/scaffold/
# Run before npm publish to bundle scaffold files with the package.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$CLI_DIR/../.." && pwd)"
SCAFFOLD="$CLI_DIR/scaffold"

echo "Preparing scaffold from $REPO_ROOT"

# Core agents (exclude developer agents — those are generated at init time)
CORE_AGENTS=(
  planner.md
  project-manager.md
  software-architect.md
  team-leader.md
  systems-developer.md
  code-style-reviewer.md
  code-logic-reviewer.md
  visual-reviewer.md
  senior-tester.md
  researcher-expert.md
  modernization-detector.md
  devops-engineer.md
  technical-content-writer.md
  ui-ux-designer.md
)

mkdir -p "$SCAFFOLD/.claude/agents"
for agent in "${CORE_AGENTS[@]}"; do
  cp "$REPO_ROOT/.claude/agents/$agent" "$SCAFFOLD/.claude/agents/$agent"
done

# Skills (full directory trees)
SKILLS=(orchestration auto-pilot technical-content-writer ui-ux-designer)
for skill in "${SKILLS[@]}"; do
  rm -rf "$SCAFFOLD/.claude/skills/$skill"
  mkdir -p "$SCAFFOLD/.claude/skills/$skill"
  cp -R "$REPO_ROOT/.claude/skills/$skill/." "$SCAFFOLD/.claude/skills/$skill/"
done

# Commands (all .md files)
mkdir -p "$SCAFFOLD/.claude/commands"
cp "$REPO_ROOT/.claude/commands/"*.md "$SCAFFOLD/.claude/commands/"

# Anti-patterns
cp "$REPO_ROOT/.claude/anti-patterns.md" "$SCAFFOLD/.claude/anti-patterns.md"

echo "Scaffold prepared: $(find "$SCAFFOLD" -type f | wc -l | tr -d ' ') files"
