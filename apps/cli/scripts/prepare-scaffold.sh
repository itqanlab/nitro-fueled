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
  nitro-planner.md
  nitro-project-manager.md
  nitro-software-architect.md
  nitro-team-leader.md
  nitro-systems-developer.md
  nitro-code-style-reviewer.md
  nitro-code-logic-reviewer.md
  nitro-code-security-reviewer.md
  nitro-visual-reviewer.md
  nitro-senior-tester.md
  nitro-test-lead.md
  nitro-review-lead.md
  nitro-researcher-expert.md
  nitro-modernization-detector.md
  nitro-devops-engineer.md
  nitro-technical-content-writer.md
  nitro-ui-ux-designer.md
  nitro-integration-tester.md
  nitro-e2e-tester.md
  nitro-unit-tester.md
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
