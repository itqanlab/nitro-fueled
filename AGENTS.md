# Repository Guidelines

## Project Structure & Module Organization
This repository centers on a TypeScript CLI in `packages/cli`.
- `packages/cli/src/` contains source code (`commands/` for subcommands, `utils/` for shared logic).
- `packages/cli/dist/` is generated build output from TypeScript.
- `packages/cli/scripts/prepare-scaffold.sh` assembles publishable scaffold assets.
- `docs/` stores architecture and design references.
- `task-tracking/` contains task records, plans, and review artifacts.

## Build, Test, and Development Commands
Run commands from `packages/cli` unless noted.
- `npm run build`: compile TypeScript from `src` to `dist`.
- `npm run dev`: watch mode compilation for local iteration.
- `npm run start`: run the built CLI (`node dist/index.js`).
- `npm run prepare-scaffold`: refresh `packages/cli/scaffold` from root `.claude` assets.
- `npm run prepublishOnly`: scaffold refresh + production build before publish.

Example:
```bash
cd packages/cli
npm run build && npm run start -- --help
```

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules, strict mode).
- Indentation: 2 spaces; prefer small, focused functions.
- Filenames: lowercase kebab-style for modules in `src/commands` and `src/utils` (for example, `stack-detect.ts`).
- Naming: `camelCase` for variables/functions, `PascalCase` for types/interfaces.
- Keep command handlers side-effect aware and isolate reusable logic in `utils/`.

## Testing Guidelines
There is currently no dedicated automated test runner configured. Minimum expectation for changes:
- `npm run build` passes without TypeScript errors.
- Manually validate affected CLI flows (for example, `init`, `create`, `run`, `status`).
- Document manual verification steps in your PR description.

## Commit & Pull Request Guidelines
Use Conventional Commits as seen in history:
- `feat(cli): implement init command...`
- `fix(cli): address review findings...`
- `docs: mark TASK_2026_009 IMPLEMENTED`

PRs should include:
- clear summary of behavior changes,
- linked task/issue (for example, `task-tracking/TASK_2026_017`),
- validation evidence (build output + manual CLI checks),
- updated docs/task-tracking files when process or behavior changes.

## Security & Configuration Tips
- Use Node.js `>=18` (see `packages/cli/package.json`).
- Do not commit machine-specific absolute paths or secrets in generated `.mcp.json`/workspace configs.
