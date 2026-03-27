# Task: Scaffold Astro Starlight Docs Site

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | DEVOPS   |
| Priority   | P1-High  |
| Complexity | Medium   |

## Description

Set up a new Astro Starlight documentation site as the replacement for the current hand-rolled HTML docs in `docs/`. The new site will live under `packages/docs/` as an Astro project. GitHub Pages should be configured to deploy from the built output via GitHub Actions.

The current `docs/` folder (index.html, nitro-fueled-overview.css, nitro-fueled-overview.js, *.md files) should be preserved during this scaffold phase — content migration happens in TASK_2026_057.

### What to set up

1. **Astro Starlight project** at `packages/docs/`
   - `npm create astro@latest` with Starlight template
   - Configure `astro.config.mjs`:
     - Site title: "Nitro-Fueled"
     - Set `base` for GitHub Pages subdirectory if needed
     - Sidebar navigation structure (sections for: Getting Started, Core Concepts, Task Format, Commands, Agents, Auto-Pilot, Examples)
     - Social links: GitHub repo
     - Dark mode as default
   - Add Tailwind CSS integration (`npx astro add tailwind`) for the landing page
   - Configure `tsconfig.json` and `package.json`

2. **Color theme / branding** — configure Starlight's CSS custom properties to match Nitro-Fueled's palette:
   - Accent: `#f97316` (orange)
   - Dark background: `#0a0e17`
   - Override in `src/styles/custom.css` and reference in `astro.config.mjs` `customCss`

3. **GitHub Actions workflow** at `.github/workflows/docs.yml`
   - Trigger: push to `main` when files under `packages/docs/` change
   - Steps: checkout → setup Node → install deps → `astro build` → deploy to GitHub Pages
   - Use official Astro GitHub Pages action: `withastro/action@v3`

4. **Stub pages** — create empty placeholder `.md` files for all planned doc sections so the sidebar renders correctly:
   - `src/content/docs/getting-started/index.md`
   - `src/content/docs/getting-started/installation.md`
   - `src/content/docs/getting-started/first-run.md`
   - `src/content/docs/concepts/index.md`
   - `src/content/docs/concepts/tasks.md`
   - `src/content/docs/concepts/workers.md`
   - `src/content/docs/concepts/supervisor.md`
   - `src/content/docs/task-format/index.md`
   - `src/content/docs/commands/index.md`
   - `src/content/docs/agents/index.md`
   - `src/content/docs/auto-pilot/index.md`
   - `src/content/docs/examples/new-project.md`
   - `src/content/docs/examples/existing-project.md`

5. **Root `index.astro`** — just a placeholder shell (the full landing page is TASK_2026_056):
   - Import Starlight's base layout or leave as a minimal page that says "Coming soon" with a link to `/docs/`
   - Should compile cleanly

6. **Update root `package.json`** workspaces to include `packages/docs`

7. **Update repo `README.md`** to link to the new docs URL

### GitHub Pages configuration note

The repo should be configured so GitHub Pages serves from the Actions output (`gh-pages` branch or `github-actions` pages source). The old `docs/` folder will be removed once the Astro site is live. For now, do NOT delete `docs/` — preserve it until TASK_2026_057 is complete.

## Dependencies

- None

## Acceptance Criteria

- [ ] `packages/docs/` exists as a valid Astro Starlight project
- [ ] `cd packages/docs && npm run dev` starts a dev server with no errors
- [ ] `npm run build` produces a `dist/` folder with static HTML
- [ ] Sidebar structure matches the planned 7-section navigation
- [ ] Nitro-Fueled orange accent color is applied via custom CSS
- [ ] GitHub Actions workflow file exists and is syntactically valid
- [ ] All stub pages render in the sidebar with no 404 errors
- [ ] Root `index.astro` compiles cleanly (even if minimal)
- [ ] Pagefind search works on the built output

## References

- Astro Starlight docs: https://starlight.astro.build/
- Astro GitHub Pages guide: https://docs.astro.build/en/guides/deploy/github/
- Official GitHub Actions workflow: https://github.com/withastro/action
- Current docs folder: `docs/`
- Design color palette: `docs/nitro-fueled-overview.css` (CSS variables at top)
