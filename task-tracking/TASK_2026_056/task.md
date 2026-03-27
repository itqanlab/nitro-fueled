# Task: Build Nitro-Fueled Marketing Landing Page

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | CREATIVE |
| Priority   | P1-High  |
| Complexity | Complex  |

## Description

Build the full marketing landing page (`src/pages/index.astro`) for the Astro Starlight docs site. This is the first thing visitors see when they land on the GitHub Pages URL — it must be compelling, informative, and visually consistent with the dark orange Nitro-Fueled brand.

The landing page lives at the Astro site root (`/`) and is completely independent from the `/docs/` Starlight section. It should use Tailwind CSS for layout and the Nitro-Fueled color palette.

### Required Sections (in order)

1. **Sticky Navigation Bar**
   - Logo: "Nitro-Fueled" with orange "Nitro" accent
   - Nav links: Why, How It Works, Get Started, Documentation
   - Right side: GitHub star button (link to repo), "View Docs →" CTA button
   - Transparent on load, solid dark background on scroll

2. **Hero**
   - Badge: "Open Source · Claude Code · Autonomous Workers"
   - H1: "Your AI dev team, end-to-end."
   - Tagline: "Install into any project. Define tasks. Nitro-Fueled runs the full PM → Architect → Build → Review pipeline with autonomous Claude sessions — while you focus on what matters."
   - Two CTA buttons: "Get Started →" (links to `/docs/getting-started/`) and "View Architecture" (links to `/docs/concepts/`)
   - Pipeline flow pill: Plan → Design → Build → Review → Complete
   - Key stats row: 55+ tasks shipped · 16 agents · 7 workflow types · 3 parallel workers

3. **The Problem** (section id: `why`)
   - Section label: "Why It Exists"
   - Title: "AI gives you code. Not engineering."
   - 3 pain point cards:
     - "You're still the PM, Architect, and QA" — every AI tool hands you code and walks away
     - "Big tasks destroy your context window" — long sessions thrash; you lose state mid-task
     - "No quality gates across sessions" — inconsistent code, no review, no memory of past mistakes

4. **The Solution**
   - Title: "Nitro-Fueled changes all of that."
   - 3 solution cards mapping 1:1 to the pain points:
     - Full pipeline: PM scopes it, Architect designs it, Team Leader batches it, Developers build it, Reviewers verify it
     - Isolated workers: Each worker gets a fresh context window via MCP — no thrashing, no context loss
     - Quality gates: Every task gets style + logic + security review before COMPLETE. Review lessons accumulate per project.

5. **How It Works** (section id: `how-it-works`)
   - Title: "Five steps from intent to shipped."
   - 5 numbered steps with icons:
     1. **Install** — `npx nitro-fueled init` detects your stack, generates project-specific agents
     2. **Define tasks** — Write a `task.md` describing what to build. Or use `/create-task` for guided creation.
     3. **Run auto-pilot** — `npx nitro-fueled run` or `/auto-pilot`. The Supervisor reads your backlog, builds a dependency graph, and starts spawning workers.
     4. **Workers execute** — Build Workers run PM → Architect → Dev. Review Workers run parallel style + logic + security checks. All in isolated iTerm2 tabs.
     5. **Review and ship** — Every task is reviewed before COMPLETE. Findings auto-fix. You merge the branch.

6. **For New Projects** (section id: `get-started`)
   - Side-by-side layout with code block on the right
   - Title: "Starting fresh? Up in 2 minutes."
   - Steps:
     1. `mkdir my-app && cd my-app`
     2. `npx nitro-fueled init` (detects stack, scaffolds agents)
     3. Create your first task with `/create-task`
     4. `npx nitro-fueled run`
   - Code block showing a sample `task.md` for a new feature

7. **For Existing Projects**
   - Title: "Already have a project? Drop it in."
   - Steps:
     1. `cd my-existing-project`
     2. `npx nitro-fueled init` (reads package.json, go.mod, requirements.txt, etc.)
     3. Existing codebase context is wired into agents automatically
     4. Define tasks for your next sprint, run auto-pilot
   - Callout: "Works with any stack — Node.js, Python, Go, Rust, React, Vue, Angular"

8. **Features Grid**
   - Title: "Everything you need."
   - 6 feature cards with icons:
     - **16 Specialized Agents** — PM, Architect, Team Leader, frontend/backend devs, 3 reviewers, tester, researcher, and more
     - **7 Workflow Types** — FEATURE, BUGFIX, REFACTORING, DOCUMENTATION, RESEARCH, DEVOPS, CREATIVE — each routes to the right agent pipeline
     - **Parallel Workers** — Up to 3 concurrent workers via MCP session-orchestrator. Each in its own iTerm2 tab with fresh context.
     - **Quality Gates** — Every task gets reviewed: code style, business logic, and security before it's marked COMPLETE
     - **Self-Healing** — Stuck worker detection, two-strike kill, Cleanup Workers that salvage uncommitted work, automatic retry
     - **Learning System** — Review lessons accumulate in `review-lessons/` per project. Each review cycle makes the next one smarter.

9. **Sample Task** (code block)
   - Title: "This is all you write."
   - Show a clean, realistic `task.md` example with syntax highlighting
   - Caption: "The rest — requirements, architecture, implementation, review — is handled autonomously."

10. **Documentation CTA**
    - Title: "Ready to ship?"
    - Two buttons: "Read the Docs →" and "View on GitHub"
    - Optional: a one-liner install command in a copy-able code block

11. **Footer**
    - Logo + tagline
    - Links: Documentation, Getting Started, Commands, Agents, GitHub
    - "Built for Claude Code · Open Source"

### Design Requirements

- Dark theme: background `#0a0e17`, consistent with existing site
- Orange accent: `#f97316` for CTAs, highlights, icons
- Blue secondary: `#3b82f6`
- Green for "complete/success" states: `#22c55e`
- Code blocks: dark background, orange syntax highlights for keys, clean monospace
- Responsive: mobile-first, collapses gracefully at 768px and 480px
- Animations: subtle fade-in on scroll for sections, no distracting motion
- Use Tailwind CSS classes throughout

### Visual Inspiration

The existing `docs/index.html` has a strong dark hero with a canvas particle network and orange glow effects. The new landing page should feel like an evolution of that visual language — cleaner, more structured, with better information hierarchy. Reference `docs/nitro-fueled-overview.css` for color variables and animation patterns.

## Dependencies

- TASK_2026_055 (Astro Starlight scaffold must exist first)

## Acceptance Criteria

- [ ] All 11 sections are present and complete with real content (no placeholder text)
- [ ] Sticky nav works and highlights active section on scroll
- [ ] Both CTA buttons link correctly to the docs
- [ ] Code blocks render with syntax highlighting
- [ ] Responsive at 1440px, 1024px, 768px, and 375px viewports
- [ ] Page passes `astro check` with no type errors
- [ ] Builds cleanly with `npm run build`
- [ ] Dark theme and orange accent are consistent throughout
- [ ] No "lorem ipsum" or stub content anywhere

## References

- Current landing page to evolve from: `docs/index.html`
- Color palette + animations: `docs/nitro-fueled-overview.css`
- JS effects (canvas particle network): `docs/nitro-fueled-overview.js`
- Design doc for content: `docs/nitro-fueled-design.md`
- Task format for the sample: `docs/task-template-guide.md`
- Astro Starlight scaffold: `packages/docs/` (created in TASK_2026_055)
