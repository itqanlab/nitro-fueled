# Task: Scaffold Angular 19 + NG-ZORRO app (apps/dashboard)

## Metadata

| Field      | Value        |
|------------|--------------|
| Type       | DEVOPS       |
| Priority   | P0-Critical  |
| Complexity | Medium       |
| Model      | default      |
| Testing    | skip         |

## Description

Generate a new Angular 19 standalone app at `apps/dashboard` using the `@nx/angular` generator. Configure NG-ZORRO Ant Design (`ng-zorro-antd`) with the dark theme preset. Set up the Nx `project.json` with build, serve, and test targets. Configure the app for later bundling into the CLI assets (set output path to `apps/dashboard/dist`). Establish the dark theme CSS custom properties matching the N.Gine mockup palette: `--bg-primary: #141414`, `--bg-secondary: #1f1f1f`, `--accent: #177ddc`, text hierarchy colors (`#e8e8e8`, `#8c8c8c`, `#595959`), status colors (success `#49aa19`, warning `#d89614`, error `#d32029`). The app must serve via `nx serve dashboard` showing a dark background at localhost with no errors.

## Dependencies

- TASK_2026_073 — provides the apps/ directory and updated Nx workspace structure

## Acceptance Criteria

- [ ] `apps/dashboard` exists as a valid Angular 19 standalone app with `@nx/angular` `project.json`
- [ ] `ng-zorro-antd` installed and configured with dark theme via `NzConfigService` or provider config
- [ ] `nx serve dashboard` starts without errors and shows dark background (`#141414`) at localhost
- [ ] `nx build dashboard` produces output in `apps/dashboard/dist` with no TypeScript errors
- [ ] CSS custom properties for the full N.Gine color palette defined in `styles.scss`

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/dashboard.html (color palette)
- https://ng.ant.design/docs/introduce/en

## File Scope

- apps/dashboard/project.json
- apps/dashboard/package.json
- apps/dashboard/tsconfig.json
- apps/dashboard/src/app/app.config.ts
- apps/dashboard/src/app/app.component.ts
- apps/dashboard/src/styles.scss
- apps/dashboard/src/main.ts
