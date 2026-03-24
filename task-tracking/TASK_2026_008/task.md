# Task: CLI Package Scaffold

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |

## Description

Create the `packages/cli/` directory with the foundational CLI package structure for nitro-fueled. This is the base that all CLI commands (init, run, status, create) build on.

**What to build:**
- `packages/cli/package.json` — name: `nitro-fueled`, bin entry for `npx nitro-fueled`
- `packages/cli/tsconfig.json` — TypeScript configuration
- `packages/cli/src/index.ts` — entry point with command parser
- `packages/cli/src/commands/` — directory for command implementations (stubs for init, run, status, create)
- Command parsing using a lightweight library (Commander.js or similar)
- Basic help text and version display

**The CLI should support:**
```
npx nitro-fueled init          # Scaffold into current project
npx nitro-fueled run           # Start Supervisor loop
npx nitro-fueled run TASK_ID   # Run specific task
npx nitro-fueled status        # Show task statuses
npx nitro-fueled create        # Interactive task creation
npx nitro-fueled --help        # Show help
npx nitro-fueled --version     # Show version
```

This task creates the scaffold only — each command's implementation is a separate task.

## Dependencies

- TASK_2026_005 — systems-developer agent needed for proper implementation

## Acceptance Criteria

- [ ] `packages/cli/` directory exists with proper structure
- [ ] `package.json` has correct name, bin entry, and dependencies
- [ ] TypeScript compiles successfully
- [ ] `npx nitro-fueled --help` shows available commands
- [ ] `npx nitro-fueled --version` shows version
- [ ] Command stubs exist for init, run, status, create
- [ ] Each stub prints "not yet implemented" when invoked

## References

- Design doc: `docs/claude-orchestrate-package-design.md`
- Commander.js or yargs for command parsing
