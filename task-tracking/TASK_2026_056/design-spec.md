# Design Specification — Nitro-Fueled Marketing Landing Page

**Target file**: `packages/docs/src/pages/index.astro`
**Task**: TASK_2026_056
**Author**: nitro-ui-ux-designer
**Date**: 2026-03-28

---

## 0. Overview and Architecture

The landing page is a **fully standalone Astro page** — it does NOT use the Starlight layout. It imports no Starlight components. It owns its `<html>`, `<head>`, `<body>`, nav, footer, and all styles.

The Tailwind integration uses `applyBaseStyles: false`, so the page must not rely on Tailwind's preflight reset. Include a minimal manual reset inside a `<style>` block or via the global CSS that handles `*, box-sizing: border-box; margin: 0; padding: 0`.

The `base` URL from `astro.config.mjs` is `/nitro-fueled`. Every internal href must be prefixed via `import.meta.env.BASE_URL`. The existing placeholder already demonstrates the pattern:

```astro
---
const base = import.meta.env.BASE_URL;
---
<a href={`${base}getting-started/`}>
```

All doc links follow this pattern. Do NOT hardcode `/nitro-fueled/` — use `base` so the site works in local dev (base is `/`) and GitHub Pages (base is `/nitro-fueled`).

---

## 1. Color System

### 1.1 CSS Custom Properties to Define

Define these in a `<style is:global>` block at the top of the page (or in `src/styles/custom.css`). These are derived from `docs/nitro-fueled-overview.css`.

```css
:root {
  --nitro-bg:           #0a0e17;
  --nitro-bg-card:      #111827;
  --nitro-bg-card-hover:#1a2332;
  --nitro-border:       #1e293b;
  --nitro-border-accent:#334155;
  --nitro-text:         #e2e8f0;
  --nitro-text-dim:     #94a3b8;
  --nitro-text-bright:  #f8fafc;
  --nitro-orange:       #f97316;
  --nitro-orange-glow:  rgba(249,115,22,0.15);
  --nitro-blue:         #3b82f6;
  --nitro-green:        #22c55e;
  --nitro-purple:       #a855f7;
  --nitro-cyan:         #06b6d4;
}
```

### 1.2 Tailwind Equivalents

The Tailwind config (`tailwind.config.mjs`) already defines `nitro-orange` and `nitro-dark`. The developer must extend it to include the full palette:

```js
// packages/docs/tailwind.config.mjs — extend theme.colors with:
'nitro-bg':           '#0a0e17',
'nitro-bg-card':      '#111827',
'nitro-bg-card-hover':'#1a2332',
'nitro-border':       '#1e293b',
'nitro-border-accent':'#334155',
'nitro-text':         '#e2e8f0',
'nitro-text-dim':     '#94a3b8',
'nitro-text-bright':  '#f8fafc',
// nitro-orange already defined as #f97316
'nitro-blue':         '#3b82f6',
'nitro-green':        '#22c55e',
'nitro-purple':       '#a855f7',
'nitro-cyan':         '#06b6d4',
```

### 1.3 Tailwind Utility Mappings

| Role                   | Hex        | Tailwind classes                                     |
|------------------------|------------|------------------------------------------------------|
| Page background        | `#0a0e17`  | `bg-nitro-bg`                                        |
| Card background        | `#111827`  | `bg-nitro-bg-card` (same as Tailwind `bg-gray-900`)  |
| Card hover background  | `#1a2332`  | `bg-nitro-bg-card-hover`                             |
| Border default         | `#1e293b`  | `border-nitro-border` (same as `border-slate-800`)   |
| Border accent          | `#334155`  | `border-nitro-border-accent`                         |
| Body text              | `#e2e8f0`  | `text-nitro-text` (same as `text-slate-200`)         |
| Muted text             | `#94a3b8`  | `text-nitro-text-dim` (same as `text-slate-400`)     |
| Bright text            | `#f8fafc`  | `text-nitro-text-bright` (same as `text-slate-50`)   |
| Orange accent / CTAs   | `#f97316`  | `text-nitro-orange` / `bg-nitro-orange`              |
| Blue secondary         | `#3b82f6`  | `text-nitro-blue` / `bg-nitro-blue`                  |
| Green / success        | `#22c55e`  | `text-nitro-green` / `bg-nitro-green`                |
| Orange text (warm)     | `#ffb078`  | Use CSS var `--nitro-orange` at 70% brightness; no Tailwind direct match — apply via `style` attribute |

### 1.4 Dark Theme Setup

The `<html>` element must carry `class="dark"` and `style="background:#0a0e17"` to prevent flash of white on load. The body also carries `bg-nitro-bg text-nitro-text`.

---

## 2. Typography Scale

Font family: **Inter** (already loaded via Starlight's default setup or must be imported via `<link>` in `<head>` if not available on the standalone page).

Add to `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
```

Body base: `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;`

### 2.1 Type Scale

| Token     | Size                           | Weight       | Tailwind classes                                                          |
|-----------|--------------------------------|--------------|---------------------------------------------------------------------------|
| H1 (Hero) | `clamp(42px, 6.6vw, 84px)`    | 850 (black)  | Use `style="font-size: clamp(42px,6.6vw,84px); font-weight:850; letter-spacing:-2.1px; line-height:1.04"` — no direct Tailwind clamp |
| H2 (section title) | 32px (`text-3xl`)   | 700          | `text-3xl font-bold text-nitro-text-bright`                               |
| H3 (card title)    | 18px (`text-lg`)    | 600          | `text-lg font-semibold text-nitro-text-bright`                            |
| H4 (label)         | 12px (`text-xs`)    | 700          | `text-xs font-bold uppercase tracking-widest text-nitro-orange`           |
| Body               | 16px (`text-base`)  | 400          | `text-base text-nitro-text leading-relaxed`                               |
| Body large         | 18px (`text-lg`)    | 400          | `text-lg text-nitro-text-dim leading-relaxed`                             |
| Caption / muted    | 13–14px (`text-sm`) | 400          | `text-sm text-nitro-text-dim`                                             |
| Code               | 13px (`text-sm`)    | 400          | `text-sm font-mono`                                                       |
| Badge / pill label | 11px                | 700          | `text-[11px] font-bold uppercase tracking-[1.6px]`                        |
| Section label      | 12px (`text-xs`)    | 700          | `text-xs font-bold uppercase tracking-[2px] text-nitro-orange`            |
| Nav links          | 14px (`text-sm`)    | 500          | `text-sm font-medium text-nitro-text-dim hover:text-nitro-text-bright`   |
| CTA button primary | 15px                | 600          | `text-[15px] font-semibold`                                               |

---

## 3. Component Specifications

### Global layout constraints
- Max content width: `max-w-[1200px] mx-auto`
- Section horizontal padding: `px-10 md:px-6 sm:px-4`
- Section vertical padding: `py-16 md:py-12`
- All sections animate in via scroll-triggered `.fade-in` class (see Section 4)

---

### Section 1: Sticky Navigation Bar

**Element**: `<nav>` — fixed to top of viewport

**Layout**: `flex items-center justify-between` with `max-w-[1200px] mx-auto px-6`

**Height**: `h-16`

**Default state** (on page load):
- Background: `bg-transparent`
- Border bottom: none
- Transition: `transition-all duration-300`

**Scrolled state** (JS adds `.nav-solid` class when `scrollY > 40`):
- Background: `bg-nitro-bg/95 backdrop-blur-md`
- Border bottom: `border-b border-nitro-border`

**Left — Logo**:
- "Nitro" in `text-nitro-orange font-black` + "-Fueled" in `text-nitro-text-bright font-black`
- Font size: `text-xl`
- The entire logo is wrapped in `<a href={base}>` (links to landing page root)

**Center — Nav links** (hidden on mobile, visible at `md:` breakpoint):
```
Why    How It Works    Get Started    Documentation
```
- Each: `text-sm font-medium text-nitro-text-dim hover:text-nitro-text-bright transition-colors`
- Links:
  - Why → `#why` (anchor on same page)
  - How It Works → `#how-it-works`
  - Get Started → `#get-started`
  - Documentation → `${base}getting-started/`

**Right**:
1. GitHub star button:
   - `<a href="https://github.com/iamb0ody/nitro-fueled" target="_blank" rel="noopener noreferrer">`
   - Style: `flex items-center gap-1.5 text-sm font-medium text-nitro-text-dim border border-nitro-border rounded-md px-3 py-1.5 hover:border-nitro-border-accent hover:text-nitro-text-bright transition-all`
   - Icon: GitHub SVG icon (16x16) + text "Star"
   - `aria-label="Star Nitro-Fueled on GitHub"`

2. "View Docs" CTA:
   - `<a href="${base}getting-started/">`
   - Style: `bg-nitro-orange text-nitro-bg font-semibold text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity`
   - Text: "View Docs →"

**Mobile**: Replace nav links with a hamburger menu button (`md:hidden`). The hamburger opens a full-width dropdown panel (`bg-nitro-bg-card border-t border-nitro-border`) with the same links stacked vertically. Toggle via JS click handler.

**Full nav HTML structure**:
```
<nav id="main-nav" class="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
  <div class="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
    <a href={base} class="logo">...</a>
    <div class="hidden md:flex items-center gap-8">...</div>
    <div class="flex items-center gap-3">
      <a href="..." class="github-btn">...</a>
      <a href="..." class="cta-btn">...</a>
    </div>
    <button class="md:hidden hamburger-btn" aria-label="Open menu">...</button>
  </div>
</nav>
```

---

### Section 2: Hero

**Element**: `<section class="hero-section">` — full viewport height on desktop, at least 90vh

**Top padding**: `pt-32` (clears the fixed nav) + `pb-24`

**Background effects** (CSS, not Tailwind — too complex for utilities):
```css
.hero-section {
  background:
    radial-gradient(120% 90% at 50% 2%, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0.02) 42%, transparent 74%),
    linear-gradient(180deg, rgba(10,16,28,0.24), rgba(10,16,28,0.58));
}
```

Two ambient glow blobs (absolutely positioned, `pointer-events-none`, `z-0`):
- Left blob: `position:absolute; top:-22vh; left:-12vw; width:44vw; height:44vw; max-width:600px; border-radius:50%; filter:blur(66px); opacity:0.26; background:radial-gradient(circle, rgba(249,115,22,0.28), transparent 70%)`
- Right blob: same approach with `rgba(22,148,255,0.2)`, positioned `top:-8vh; right:-16vw`

Content is `position:relative; z-index:2`.

**Inner layout**: `text-center max-w-[1120px] mx-auto px-6`

**Badge** (top of hero):
- Text: "Open Source · Claude Code · Autonomous Workers"
- Style: `inline-block px-[18px] py-2 text-[11px] font-bold uppercase tracking-[1.6px] rounded-full`
- Background: `linear-gradient(180deg, rgba(249,115,22,0.22), rgba(249,115,22,0.06))`
- Border: `1px solid rgba(249,115,22,0.65)`
- Text color: `#ffd6bf` (warm cream — no Tailwind match, use inline style or CSS class)
- Box shadow: `inset 0 0 0 1px rgba(255,165,94,0.15), 0 0 28px rgba(249,115,22,0.18)`

**H1**:
- Text: "Your AI dev team, end-to-end."
- Style: `mt-5` + CSS `font-size: clamp(42px,6.6vw,84px); font-weight:850; letter-spacing:-2.1px; line-height:1.04; color:#f8fafc`
- No special word accents in this H1 (plain bright white)
- Text shadow: `0 0 26px rgba(249,115,22,0.16), 0 0 74px rgba(67,134,255,0.12)`

**Tagline** (paragraph):
- Text: "Install into any project. Define tasks. Nitro-Fueled runs the full PM → Architect → Build → Review pipeline with autonomous Claude sessions — while you focus on what matters."
- Style: `mt-5 mx-auto max-w-[760px] text-[#a8bad8] leading-[1.58]` + CSS `font-size: clamp(16px,1.9vw,18px)`

**CTA buttons** (stacked horizontally, gap-4, centered, mt-8):

Button 1 — "Get Started →" (primary):
- `<a href="${base}getting-started/">`
- Style: `inline-flex items-center gap-2 bg-nitro-orange text-nitro-bg font-semibold px-8 py-3.5 rounded-lg text-[15px] hover:opacity-90 transition-opacity shadow-[0_0_24px_rgba(249,115,22,0.35)]`
- Hover: `hover:shadow-[0_0_32px_rgba(249,115,22,0.5)]`

Button 2 — "View Architecture" (secondary/ghost):
- `<a href="${base}concepts/">`
- Style: `inline-flex items-center gap-2 border border-nitro-border-accent text-nitro-text-dim font-semibold px-8 py-3.5 rounded-lg text-[15px] hover:border-nitro-orange hover:text-nitro-text-bright transition-all`

**Pipeline Flow Pill** (mt-10):
- Container: `flex items-center justify-center gap-2.5 flex-wrap`
- 5 stage pills + 4 arrows between them
- Stage pill style: `px-3 py-1.5 rounded-full border border-[rgba(130,166,215,0.24)] bg-[linear-gradient(180deg,rgba(24,37,62,0.55),rgba(15,23,40,0.38))] text-[#dce9ff] text-xs font-bold uppercase tracking-[0.72px]`
- Arrow style: `text-[#ff9f5f] text-sm` with CSS `animation: flowPulse 2s ease-in-out infinite`
- Stage labels: **Plan** → **Design** → **Build** → **Review** → **Complete**
- "Complete" pill gets `border-nitro-green text-nitro-green` instead of the default slate

**Key Stats Row** (mt-10):
- Container: `flex justify-center gap-11 flex-wrap`
- 4 stat items:
  1. Number: **55+** / Label: "Tasks Shipped"
  2. Number: **16** / Label: "Agents"
  3. Number: **7** / Label: "Workflow Types"
  4. Number: **3** / Label: "Parallel Workers"
- Stat number style: CSS `font-size:35px; font-weight:800; color:#ffb078; animation: breatheNum 4.1s ease-in-out infinite`
- Stat label style: `text-xs uppercase tracking-[1px] text-[#90a8cb] mt-1`

**Mobile (max-width: 768px)**:
- Hero padding reduces to `pt-24 pb-16`
- CTA buttons stack vertically (`flex-col items-center`)
- Pipeline pills wrap naturally
- Stats gap reduces to `gap-6`

---

### Section 3: The Problem

**Element**: `<section id="why">` with scroll fade-in

**Layout**: `max-w-[1200px] mx-auto py-16 px-10`

**Section label**: "Why It Exists" — `text-xs font-bold uppercase tracking-[2px] text-nitro-orange mb-2`

**Section title**: "AI gives you code. Not engineering." — `text-3xl font-bold text-nitro-text-bright mb-10`

**Cards grid**: `grid grid-cols-3 gap-4` (collapses to `grid-cols-1` at `md:`)

Each pain point card:
- Container: `bg-nitro-bg-card border border-nitro-border rounded-xl p-6 hover:border-nitro-border-accent hover:bg-nitro-bg-card-hover transition-all duration-200`
- Box shadow: `shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_28px_rgba(7,10,18,0.45)]`
- Icon area: 40x40 div with a relevant icon, colored in a muted semantic color (see below)
- Card title: `text-lg font-semibold text-nitro-text-bright mt-4 mb-2`
- Card body: `text-sm text-nitro-text-dim leading-relaxed`

**Card 1 — Role Overload**
- Icon: person-with-arrows or org-chart SVG, color: `text-nitro-orange`
- Icon container background: `bg-[rgba(249,115,22,0.1)] rounded-lg p-2`
- Title: "You're still the PM, Architect, and QA"
- Body: "Every AI tool hands you code and walks away. You still define scope, design the solution, review the output, and manage state across sessions."

**Card 2 — Context Destruction**
- Icon: broken-window or error SVG, color: `text-nitro-blue`
- Icon container background: `bg-[rgba(59,130,246,0.1)] rounded-lg p-2`
- Title: "Big tasks destroy your context window"
- Body: "Long sessions thrash. You lose state mid-task. The model forgets the plan, regresses on constraints, and you start over."

**Card 3 — No Quality Gates**
- Icon: shield-with-x SVG, color: `text-nitro-purple`
- Icon container background: `bg-[rgba(168,85,247,0.1)] rounded-lg p-2`
- Title: "No quality gates across sessions"
- Body: "Inconsistent code, no peer review, no memory of past mistakes. There is no system — only you, manually catching what slipped through."

**Mobile**: Cards stack to single column. No change to card internals.

---

### Section 4: The Solution

**Element**: `<section>` with scroll fade-in (no id needed, not a nav target)

**Layout**: same as Section 3 (`max-w-[1200px] mx-auto py-16 px-10`)

**Section title**: "Nitro-Fueled changes all of that." — `text-3xl font-bold text-nitro-text-bright mb-10`

**Visual treatment**: This section has a subtle orange top-border accent strip:
- `border-t-2 border-nitro-orange/30` on the section wrapper
- Or: A 1px gradient line: `background: linear-gradient(90deg, transparent, rgba(249,115,22,0.4), transparent)` at 1px height, full width

**Cards grid**: same `grid grid-cols-3 gap-4 md:grid-cols-1` as Section 3

Each solution card maps 1:1 to a pain point above. Use green as the primary accent for this section (it signals resolution):

**Card 1 — Full Pipeline**
- Icon: pipeline/flow SVG, color: `text-nitro-green`
- Icon container background: `bg-[rgba(34,197,94,0.1)] rounded-lg p-2`
- Title: "Full engineering pipeline"
- Body: "PM scopes it. Architect designs it. Team Leader batches it. Developers build it. Reviewers verify it. Every role covered — none of it is you."

**Card 2 — Isolated Workers**
- Icon: container/isolated-box SVG, color: `text-nitro-cyan`
- Icon container background: `bg-[rgba(6,182,212,0.1)] rounded-lg p-2`
- Title: "Isolated workers, zero thrashing"
- Body: "Each worker gets a fresh context window via MCP session-orchestrator. No compaction. No state bleed. Tasks run clean, in parallel, in their own iTerm2 tab."

**Card 3 — Quality Gates**
- Icon: shield-check SVG, color: `text-nitro-orange`
- Icon container background: `bg-[rgba(249,115,22,0.1)] rounded-lg p-2`
- Title: "Quality gates on every task"
- Body: "Every task gets code style, business logic, and security review before COMPLETE. Review findings auto-fix. Lessons accumulate per project — the next review is smarter."

---

### Section 5: How It Works

**Element**: `<section id="how-it-works">` with scroll fade-in

**Layout**: `max-w-[1200px] mx-auto py-16 px-10`

**Section label**: "How It Works" — standard label style

**Section title**: "Five steps from intent to shipped." — `text-3xl font-bold text-nitro-text-bright mb-12`

**Steps layout**: Vertical stacked list — `flex flex-col gap-6`

Each step is a row:
```
[Number circle] | [Icon] | [Text block]
```

Step row container: `flex items-start gap-5 p-6 bg-nitro-bg-card border border-nitro-border rounded-xl hover:border-nitro-border-accent transition-colors`

**Number circle**: `w-9 h-9 shrink-0 rounded-full bg-nitro-orange/10 border border-nitro-orange/30 flex items-center justify-center text-sm font-bold text-nitro-orange`

**Icon**: 20x20, `text-nitro-text-dim shrink-0 mt-0.5`

**Text block**:
- Step title: `text-base font-semibold text-nitro-text-bright mb-1`
- Step body: `text-sm text-nitro-text-dim leading-relaxed`
- Inline code snippets: `font-mono text-nitro-orange bg-nitro-bg px-1.5 py-0.5 rounded text-xs`

**Step content**:

1. **Install**
   - Title: "Install"
   - Body: "Run `npx nitro-fueled init` in your project. Nitro detects your stack, generates project-specific agents, and scaffolds the full `.claude/` orchestration layer."

2. **Define Tasks**
   - Title: "Define tasks"
   - Body: "Write a `task.md` describing what to build. Or run `/create-task` for guided, interactive task creation. Include acceptance criteria — the pipeline reads them."

3. **Run Auto-Pilot**
   - Title: "Run auto-pilot"
   - Body: "Run `npx nitro-fueled run` or the `/auto-pilot` command. The Supervisor reads your backlog, builds a dependency graph, and begins spawning workers in priority order."

4. **Workers Execute**
   - Title: "Workers execute"
   - Body: "Build Workers run PM → Architect → Dev in isolated sessions. Review Workers run parallel style, logic, and security checks. Each worker lives in its own iTerm2 tab with a fresh context window."

5. **Review and Ship**
   - Title: "Review and ship"
   - Body: "Every task is reviewed before COMPLETE. Findings auto-fix. You inspect the diff, approve, and merge. The Supervisor marks the task complete and moves to the next."

**Mobile**: Steps remain stacked — no change. The horizontal row layout stays the same but wraps naturally.

---

### Section 6: For New Projects

**Element**: `<section id="get-started">` with scroll fade-in

**Layout**: `max-w-[1200px] mx-auto py-16 px-10` — **two-column** at desktop: `grid grid-cols-2 gap-12 items-start md:grid-cols-1`

**Left column**:

Section label: "For New Projects"

Title: "Starting fresh? Up in 2 minutes." — `text-3xl font-bold text-nitro-text-bright mb-8`

Steps list (`flex flex-col gap-4`):
- Each step: `flex items-start gap-3`
- Step number: `w-6 h-6 shrink-0 rounded-full bg-nitro-orange text-nitro-bg text-xs font-bold flex items-center justify-center mt-0.5`
- Step text: `text-sm text-nitro-text-dim leading-relaxed` with inline code in `font-mono text-nitro-orange bg-nitro-bg px-1 rounded text-xs`

Step 1: `mkdir my-app && cd my-app`
Step 2: `npx nitro-fueled init` — detects your stack, generates agents, scaffolds `.claude/`
Step 3: Create your first task with `/create-task` — guided, interactive, outputs a ready `task.md`
Step 4: `npx nitro-fueled run` — Supervisor takes over from here

**Right column** — Code block (see Section 6 of this spec for full code block styling):

Shows a sample `task.md` for a new feature. Displayed as a dark terminal-style code block.

```
# Task: Add User Authentication

## Metadata
| Field      | Value    |
|------------|----------|
| Type       | FEATURE  |
| Priority   | P1-High  |
| Complexity | Medium   |

## Description
Add JWT-based authentication to the REST API.
Users should be able to register, log in, and
access protected routes via Bearer token.

## Acceptance Criteria
- [ ] POST /auth/register creates a user
- [ ] POST /auth/login returns a signed JWT
- [ ] Protected routes return 401 without token
- [ ] Passwords hashed with bcrypt (rounds ≥ 12)
```

**Mobile**: Grid collapses to single column. Code block appears below steps.

---

### Section 7: For Existing Projects

**Element**: `<section>` with scroll fade-in (no nav target id)

**Layout**: `max-w-[1200px] mx-auto py-16 px-10`

**Section label**: "For Existing Projects"

**Title**: "Already have a project? Drop it in." — `text-3xl font-bold text-nitro-text-bright mb-8`

**Steps list**: Same styling as Section 6 left column steps, but 4 steps:

Step 1: `cd my-existing-project`
Step 2: `npx nitro-fueled init` — reads `package.json`, `go.mod`, `requirements.txt`, etc. Wires your stack into agents automatically.
Step 3: Your existing codebase is wired into agent context. No migration, no setup beyond init.
Step 4: Define tasks for your next sprint, then run auto-pilot. Pick up where your team left off.

**Callout box** (below the steps):
- Container: `mt-8 p-5 rounded-xl border border-nitro-cyan/30 bg-[rgba(6,182,212,0.06)] flex items-start gap-3`
- Icon: info circle, `text-nitro-cyan w-5 h-5 shrink-0 mt-0.5`
- Text: `text-sm text-nitro-text-dim`
- Content: "Works with any stack — Node.js, Python, Go, Rust, React, Vue, Angular, and more. Stack detection reads your project's dependency files and generates the right agents automatically."

**Layout note**: This section does NOT use a two-column layout. Steps take 60% of the width at desktop (`max-w-[720px]`) and the callout spans below them. At mobile, full width.

---

### Section 8: Features Grid

**Element**: `<section>` with scroll fade-in

**Layout**: `max-w-[1200px] mx-auto py-16 px-10`

**Section label**: "Features"

**Title**: "Everything you need." — `text-3xl font-bold text-nitro-text-bright mb-10`

**Cards grid**: `grid grid-cols-3 gap-5 md:grid-cols-2 sm:grid-cols-1`

Each feature card:
- Container: `bg-nitro-bg-card border border-nitro-border rounded-xl p-6 flex flex-col gap-3 hover:border-nitro-border-accent hover:bg-nitro-bg-card-hover transition-all duration-200 group`
- Box shadow: `shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_16px_rgba(7,10,18,0.4)]`
- Icon area: `w-10 h-10 rounded-lg flex items-center justify-center` with semantic color tint
- Feature title: `text-base font-semibold text-nitro-text-bright`
- Feature body: `text-sm text-nitro-text-dim leading-relaxed`

**Feature 1 — 16 Specialized Agents**
- Icon: users-group SVG, `text-nitro-blue`, bg: `bg-[rgba(59,130,246,0.1)]`
- Title: "16 Specialized Agents"
- Body: "PM, Architect, Team Leader, frontend and backend developers, 3 reviewers, tester, researcher, and more. Every role covered, every task routed to the right expert."

**Feature 2 — 7 Workflow Types**
- Icon: git-branch SVG, `text-nitro-purple`, bg: `bg-[rgba(168,85,247,0.1)]`
- Title: "7 Workflow Types"
- Body: "FEATURE, BUGFIX, REFACTORING, DOCUMENTATION, RESEARCH, DEVOPS, CREATIVE — each routes to the right agent pipeline automatically based on task type."

**Feature 3 — Parallel Workers**
- Icon: layers SVG, `text-nitro-cyan`, bg: `bg-[rgba(6,182,212,0.1)]`
- Title: "Parallel Workers"
- Body: "Up to 3 concurrent workers via MCP session-orchestrator. Each in its own iTerm2 tab with a fresh context window. Dependency-aware scheduling prevents conflicts."

**Feature 4 — Quality Gates**
- Icon: shield-check SVG, `text-nitro-green`, bg: `bg-[rgba(34,197,94,0.1)]`
- Title: "Quality Gates"
- Body: "Every task gets reviewed: code style, business logic, and security before it's marked COMPLETE. No task ships without passing all three gates."

**Feature 5 — Self-Healing**
- Icon: refresh/cycle SVG, `text-nitro-orange`, bg: `bg-[rgba(249,115,22,0.1)]`
- Title: "Self-Healing"
- Body: "Stuck worker detection, two-strike kill, Cleanup Workers that salvage uncommitted work, and automatic retry. The Supervisor keeps the pipeline moving."

**Feature 6 — Learning System**
- Icon: brain/sparkle SVG, `text-yellow-400`, bg: `bg-yellow-400/10`
- Title: "Learning System"
- Body: "Review lessons accumulate in `review-lessons/` per project. Each review cycle makes the next one smarter. The system gets better the more you use it."

**Mobile**: Grid collapses `md:grid-cols-2` then `sm:grid-cols-1`.

---

### Section 9: Sample Task

**Element**: `<section>` with scroll fade-in

**Layout**: `max-w-[1200px] mx-auto py-16 px-10`

**Section label**: "Task Format"

**Title**: "This is all you write." — `text-3xl font-bold text-nitro-text-bright mb-3`

**Subtitle**: `text-base text-nitro-text-dim mb-8` — "The rest — requirements, architecture, implementation, review — is handled autonomously."

**Code block**: Full-width, large, with line numbers (see Section 6 of this spec for code block styling). Content is the complete realistic `task.md` example (see Section 6 below).

**Caption below code block**: `text-sm text-nitro-text-dim text-center mt-6` — "Nitro reads this file and orchestrates the full pipeline. You define the goal — Nitro executes it."

---

### Section 10: Documentation CTA

**Element**: `<section>` with scroll fade-in — visually distinct from surrounding sections

**Background**: Full-width orange gradient band:
```css
background: linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.06) 50%, rgba(59,130,246,0.08) 100%);
border-top: 1px solid rgba(249,115,22,0.25);
border-bottom: 1px solid rgba(249,115,22,0.15);
```

**Layout**: `max-w-[1200px] mx-auto py-20 px-10 text-center`

**Title**: "Ready to ship?" — `text-4xl font-bold text-nitro-text-bright mb-4`

**Subtitle**: `text-lg text-nitro-text-dim mb-10` — "Join the projects already running autonomous pipelines with Nitro-Fueled."

**Install command block** (centered, before the CTA buttons):
- Container: `inline-flex items-center gap-3 bg-nitro-bg border border-nitro-border rounded-lg px-5 py-3 mb-10 mx-auto`
- Code text: `font-mono text-nitro-orange text-sm`
- Content: `npx nitro-fueled init`
- Copy button: clipboard SVG icon, `text-nitro-text-dim hover:text-nitro-text-bright cursor-pointer transition-colors`
- `aria-label="Copy install command"`
- JS: on click, copies `npx nitro-fueled init` to clipboard, icon changes to checkmark for 2 seconds

**CTA buttons** (`flex items-center justify-center gap-4 flex-wrap`):

Button 1 — "Read the Docs →" (primary):
- `<a href="${base}getting-started/">`
- Style: `inline-flex items-center gap-2 bg-nitro-orange text-nitro-bg font-semibold px-8 py-3.5 rounded-lg text-[15px] hover:opacity-90 transition-opacity shadow-[0_0_24px_rgba(249,115,22,0.35)]`

Button 2 — "View on GitHub" (secondary):
- `<a href="https://github.com/iamb0ody/nitro-fueled" target="_blank" rel="noopener noreferrer">`
- Style: `inline-flex items-center gap-2 border border-nitro-border-accent text-nitro-text-dim font-semibold px-8 py-3.5 rounded-lg text-[15px] hover:border-nitro-orange hover:text-nitro-text-bright transition-all`
- Include GitHub SVG icon

---

### Section 11: Footer

**Element**: `<footer>` — no scroll fade-in (always visible)

**Layout**: `bg-nitro-bg border-t border-nitro-border`

**Inner**: `max-w-[1200px] mx-auto py-12 px-10`

**Two rows**:

Row 1 — `flex items-start justify-between gap-8 md:flex-col`:

- Left: Logo + tagline
  - Logo: same as nav — "Nitro" orange + "-Fueled" bright
  - Tagline below: `text-sm text-nitro-text-dim mt-2 max-w-[280px]` — "Reusable AI orchestration for any project. Full PM → Dev → QA pipeline, autonomous."

- Right: Link groups in `flex gap-12 md:gap-6 md:flex-wrap`:
  - Column "Product": Documentation, Getting Started, Commands, Agents
  - Column "Project": GitHub, Changelog, Issues, Discussions

Link style: `text-sm text-nitro-text-dim hover:text-nitro-text-bright transition-colors`
Column header: `text-xs font-bold uppercase tracking-widest text-nitro-text-dim mb-3`

Links:
- Documentation → `${base}getting-started/`
- Getting Started → `${base}getting-started/installation/`
- Commands → `${base}commands/`
- Agents → `${base}agents/`
- GitHub → `https://github.com/iamb0ody/nitro-fueled` (opens in new tab)

Row 2 — `mt-10 pt-6 border-t border-nitro-border flex items-center justify-between md:flex-col md:gap-2`:

- Left: `text-xs text-nitro-text-dim` — "Built for Claude Code · Open Source · MIT License"
- Right: `text-xs text-nitro-text-dim` — "© 2026 Nitro-Fueled"

---

## 4. Animation Spec

### 4.1 Keyframe Definitions

Define these in the page's `<style>` block or in `src/styles/custom.css`:

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes softGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.0); }
  50%       { box-shadow: 0 0 0 8px rgba(249,115,22,0.06); }
}

@keyframes flowPulse {
  0%, 100% { opacity: 0.7; transform: translateX(0); }
  50%       { opacity: 1;   transform: translateX(1px); }
}

@keyframes floatBlobA {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50%       { transform: translate3d(3%,-2%,0) scale(1.08); }
}

@keyframes floatBlobB {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50%       { transform: translate3d(-3%,2%,0) scale(1.07); }
}

@keyframes breatheNum {
  0%, 100% { transform: translateY(0);   opacity: 0.92; }
  50%       { transform: translateY(-1px); opacity: 1; }
}
```

### 4.2 Scroll Fade-In (Sections 3–10)

All non-hero sections start hidden and animate in when they enter the viewport.

**CSS classes**:
```css
.fade-in {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.55s ease, transform 0.55s ease;
}
.fade-in.visible {
  opacity: 1;
  transform: translateY(0);
}
```

**Which sections get `.fade-in`**: Sections 3, 4, 5, 6, 7, 8, 9, 10. Also apply to individual cards within sections for a staggered effect (see 4.3).

**Hero (Section 2) does NOT get scroll fade-in** — it is already visible on load and should appear immediately.

**IntersectionObserver script** (in a `<script>` block at bottom of page):
```js
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));
```

### 4.3 Staggered Card Animation

For the 3-column and 6-card grids (Sections 3, 4, 8), apply staggered delays to each card:

```css
.fade-in:nth-child(1) { transition-delay: 0ms; }
.fade-in:nth-child(2) { transition-delay: 80ms; }
.fade-in:nth-child(3) { transition-delay: 160ms; }
.fade-in:nth-child(4) { transition-delay: 240ms; }
.fade-in:nth-child(5) { transition-delay: 320ms; }
.fade-in:nth-child(6) { transition-delay: 400ms; }
```

Apply `.fade-in` directly to each card `<div>`. The `nth-child` selector targets cards within their grid parent.

### 4.4 Nav Transparent-to-Solid on Scroll

**Script logic** (in `<script>` block):
```js
const nav = document.getElementById('main-nav');
function updateNav() {
  if (window.scrollY > 40) {
    nav.classList.add('nav-solid');
  } else {
    nav.classList.remove('nav-solid');
  }
}
window.addEventListener('scroll', updateNav, { passive: true });
updateNav(); // run on mount
```

**CSS**:
```css
#main-nav {
  transition: background 0.3s ease, border-color 0.3s ease,
              backdrop-filter 0.3s ease;
}
#main-nav.nav-solid {
  background: rgba(10, 14, 23, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #1e293b;
}
```

### 4.5 Pipeline Flow Pulse

The arrow characters (`→`) between pipeline stage pills in the hero get the `flowPulse` animation:
```css
.pipeline-arrow {
  color: #ff9f5f;
  font-size: 14px;
  animation: flowPulse 2s ease-in-out infinite;
}
/* Stagger arrow animations */
.pipeline-arrow:nth-child(2) { animation-delay: 0.5s; }
.pipeline-arrow:nth-child(3) { animation-delay: 1.0s; }
.pipeline-arrow:nth-child(4) { animation-delay: 1.5s; }
```

### 4.6 Hero Stat Counter Animation

The stats numbers animate in when the hero loads using a count-up effect:

```js
// Run on DOMContentLoaded
function animateCounter(el, target, suffix) {
  const duration = 1200;
  const step = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current) + suffix;
    if (current >= target) clearInterval(timer);
  }, 16);
}
// Usage:
animateCounter(document.getElementById('stat-tasks'), 55, '+');
animateCounter(document.getElementById('stat-agents'), 16, '');
animateCounter(document.getElementById('stat-workflows'), 7, '');
animateCounter(document.getElementById('stat-workers'), 3, '');
```

Give each stat number a unique id: `stat-tasks`, `stat-agents`, `stat-workflows`, `stat-workers`.

### 4.7 Background Blob Animations

The two ambient blobs fixed in the page background (via `body::before` and `body::after` or two fixed `<div>` elements) use `floatBlobA` and `floatBlobB`:

```css
.blob-a {
  position: fixed; top: -14vh; left: -12vw;
  width: clamp(280px, 40vw, 560px);
  height: clamp(280px, 40vw, 560px);
  border-radius: 50%;
  pointer-events: none; z-index: -1;
  filter: blur(70px); opacity: 0.2;
  background: radial-gradient(circle, rgba(6,182,212,0.22), transparent 70%);
  animation: floatBlobA 20s ease-in-out infinite;
}
.blob-b {
  position: fixed; right: -12vw; bottom: -18vh;
  width: clamp(280px, 40vw, 560px);
  height: clamp(280px, 40vw, 560px);
  border-radius: 50%;
  pointer-events: none; z-index: -1;
  filter: blur(70px); opacity: 0.2;
  background: radial-gradient(circle, rgba(249,115,22,0.2), transparent 70%);
  animation: floatBlobB 22s ease-in-out infinite;
}
```

Place as the first two children of `<body>` (before the nav).

### 4.8 Respecting Reduced Motion

Wrap all animation definitions in `@media (prefers-reduced-motion: no-preference)`. When reduced motion is preferred, elements should still become visible (opacity 1) but without the transition:

```css
@media (prefers-reduced-motion: reduce) {
  .fade-in {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .pipeline-arrow,
  .hero-stat .num,
  .blob-a, .blob-b {
    animation: none;
  }
}
```

---

## 5. Astro-Specific Notes

### 5.1 Page Frontmatter

The page must opt out of the Starlight layout. The existing placeholder demonstrates the correct approach: no `layout` frontmatter key. Any Starlight layout that Astro might auto-apply via `pages/` convention must be prevented by not importing Starlight components.

```astro
---
const base = import.meta.env.BASE_URL;
// Ensure base ends with a slash
const baseUrl = base.endsWith('/') ? base : base + '/';
---
```

Use `baseUrl` for all internal links: `href={`${baseUrl}getting-started/`}`

### 5.2 Document Structure

Since this is a standalone page (not using Starlight's `<StarlightPage>`), it owns the full `<html>` structure:

```astro
<!DOCTYPE html>
<html lang="en" class="dark" style="background:#0a0e17">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Reusable AI orchestration for any project. Full PM → Architect → Build → Review pipeline with autonomous Claude sessions." />
    <title>Nitro-Fueled — AI Dev Team Orchestration</title>
    <!-- Inter font -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href={`${baseUrl}favicon.svg`} />
    <style>
      /* All custom CSS here */
    </style>
  </head>
  <body class="bg-nitro-bg text-nitro-text font-['Inter',system-ui,sans-serif] overflow-x-hidden">
    <!-- Blobs -->
    <!-- Nav -->
    <!-- Sections -->
    <!-- Footer -->
    <!-- Scripts -->
  </body>
</html>
```

### 5.3 Tailwind in Standalone Pages

The `tailwind` integration (`applyBaseStyles: false`) processes Tailwind utility classes in `.astro` files. Since `applyBaseStyles: false` is set, include a minimal manual CSS reset in the page `<style>` block:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
img, video {
  max-width: 100%;
  display: block;
}
```

### 5.4 Internal Link Patterns

| Destination                | Href value                              |
|----------------------------|-----------------------------------------|
| Landing page root          | `{baseUrl}`                             |
| Getting Started            | `{baseUrl}getting-started/`             |
| Getting Started — Install  | `{baseUrl}getting-started/installation/`|
| Getting Started — First Run| `{baseUrl}getting-started/first-run/`   |
| Core Concepts              | `{baseUrl}concepts/`                    |
| Commands                   | `{baseUrl}commands/`                    |
| Agents                     | `{baseUrl}agents/`                      |
| Auto-Pilot                 | `{baseUrl}auto-pilot/`                  |
| Task Format                | `{baseUrl}task-format/`                 |
| Anchor: Why section        | `#why`                                  |
| Anchor: How It Works       | `#how-it-works`                         |
| Anchor: Get Started        | `#get-started`                          |

### 5.5 Script Blocks

All JavaScript goes in a `<script>` block at the bottom of the page, before `</body>`. Astro automatically scopes `<script>` to the page in SSG mode. No `is:inline` is needed unless the script must run before hydration (it does not).

```astro
<script>
  // 1. Nav scroll behavior
  // 2. IntersectionObserver for fade-in
  // 3. Counter animation for stats
  // 4. Clipboard copy for install command
  // 5. Mobile hamburger toggle
</script>
```

### 5.6 No Starlight Components

Do NOT import: `PageFrame`, `Sidebar`, `Header`, `Hero` from `@astrojs/starlight`. The page is 100% custom HTML + Tailwind.

---

## 6. Code Block Styling

### 6.1 Visual Design

Code blocks across the page (Sections 6, 9, 10) share a consistent visual treatment:

**Container**:
```css
.code-block {
  background: #080c14;          /* darker than page bg */
  border: 1px solid #1e293b;
  border-radius: 12px;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.65;
}
```

**Header bar** (mimics terminal chrome):
```css
.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #0d1220;
  border-bottom: 1px solid #1e293b;
}
```
- Left: three traffic light dots (`w-3 h-3 rounded-full` in `bg-red-500/60`, `bg-yellow-500/60`, `bg-green-500/60`, with `gap-1.5`)
- Right: filename label — `text-xs text-nitro-text-dim font-mono` — "task.md"

**Code area**:
```css
.code-block-body {
  padding: 20px 24px;
  overflow-x: auto;
}
```

**Syntax highlighting** (applied via CSS classes on `<span>` elements):

| Token type           | Class          | Color          | Tailwind / Inline                    |
|----------------------|----------------|----------------|--------------------------------------|
| Heading `#` prefix   | `.tok-heading` | `#ff9f5f`      | warm orange (hero accent color)      |
| Markdown table `|`   | `.tok-border`  | `#334155`      | muted slate                          |
| Key / field names    | `.tok-key`     | `#f97316`      | `text-nitro-orange`                  |
| Field values         | `.tok-value`   | `#a8bad8`      | muted blue-gray                      |
| Checkbox `- [ ]`     | `.tok-check`   | `#94a3b8`      | muted                                |
| Checkbox text        | `.tok-task`    | `#e2e8f0`      | `text-nitro-text`                    |
| Comments / labels    | `.tok-comment` | `#4b5563`      | `text-gray-600`                      |
| Inline code backtick | `.tok-inline`  | `#22c55e`      | `text-nitro-green`                   |

**Implementation note**: Since this is a standalone page without a Markdown processor, render the code block as `<pre><code>` with manual `<span class="tok-*">` wrapping. Do not depend on Shiki or Prism — those are only available inside `.md` files rendered by Starlight.

Alternatively, use a single `<pre>` with `color:#a8bad8` as base and orange for lines starting with `#`:

```css
.code-block pre { color: #a8bad8; }
.code-block .tok-heading { color: #ff9f5f; font-weight: 700; }
.code-block .tok-key     { color: #f97316; }
.code-block .tok-value   { color: #dce9ff; }
.code-block .tok-check   { color: #94a3b8; }
.code-block .tok-inline  { color: #22c55e; }
```

### 6.2 Sample task.md Content for Section 9 (Full Example)

This is the content to display in Section 9's code block. Apply token spans as specified above.

```
# Task: Add User Authentication

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |

## Description

Add JWT-based authentication to the REST API.
Users should be able to register, log in, and
access protected routes via Bearer token.
Passwords must be hashed. Tokens expire in 7 days.

## Acceptance Criteria

- [ ] POST /auth/register creates a user record
- [ ] POST /auth/login returns a signed JWT
- [ ] Protected routes return 401 without valid token
- [ ] Passwords hashed with bcrypt (rounds >= 12)
- [ ] Token expiry enforced server-side
- [ ] Unit tests cover happy path and error cases

## References

- Existing user model: src/models/user.ts
- Auth middleware pattern: docs/architecture.md
```

### 6.3 Inline Command Snippets

For inline shell commands used within step descriptions (Sections 5, 6, 7):

```css
code.inline-cmd {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #f97316;
  background: #080c14;
  border: 1px solid #1e293b;
  border-radius: 4px;
  padding: 2px 6px;
}
```

Tailwind equivalent: `font-mono text-xs text-nitro-orange bg-[#080c14] border border-nitro-border rounded px-1.5 py-0.5`

---

## 7. Accessibility

### 7.1 Color Contrast Ratios

All text must meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text ≥18px or bold ≥14px):

| Foreground          | Background         | Ratio   | Standard | Status |
|---------------------|--------------------|---------|----------|--------|
| `#e2e8f0` (body)    | `#0a0e17` (page)   | ~12.5:1 | AA       | PASS   |
| `#94a3b8` (muted)   | `#0a0e17` (page)   | ~5.8:1  | AA       | PASS   |
| `#94a3b8` (muted)   | `#111827` (card)   | ~4.9:1  | AA       | PASS   |
| `#f8fafc` (bright)  | `#0a0e17` (page)   | ~17.7:1 | AA       | PASS   |
| `#f97316` (orange)  | `#0a0e17` (page)   | ~4.5:1  | AA large | PASS (large text only) |
| `#f97316` (orange)  | `#111827` (card)   | ~4.2:1  | AA       | BORDERLINE — use only at 16px+ bold |
| `#0a0e17` (dark)    | `#f97316` (orange) | ~4.5:1  | AA       | PASS (for CTA button text) |
| `#22c55e` (green)   | `#0a0e17` (page)   | ~6.5:1  | AA       | PASS   |
| `#3b82f6` (blue)    | `#0a0e17` (page)   | ~4.5:1  | AA large | PASS (large text only) |

**Action items for developer**:
- Do not use `text-nitro-orange` on small body text (< 16px) against dark card backgrounds. Orange is safe for headings, labels (large bold), and icons with a distinct icon background.
- Use `text-nitro-text-dim` (`#94a3b8`) for body text, not the dimmer `#7f95b0` variant.
- CTA button text (`#0a0e17` on `#f97316`) passes at all sizes.

### 7.2 Semantic HTML

- Use `<nav>`, `<main>`, `<section>`, `<footer>`, `<h1>`–`<h4>` in proper hierarchy
- Only one `<h1>` on the page (the hero heading)
- Section headings are `<h2>` (section titles) and `<h3>` (card titles)
- Pipeline stages inside the hero are `<span>` elements — they are decorative, not headings
- The stats row is decorative (no semantic importance) — wrap in a `<div role="presentation">`

### 7.3 Focus States

All interactive elements must have visible focus rings. Since this page uses custom styling, do not rely on the browser's default focus outline being visible against a dark background.

```css
:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 3px;
  border-radius: 4px;
}
```

Add this globally. It targets only keyboard-triggered focus (not click).

### 7.4 Aria Labels for Icon-Only Elements

| Element                         | `aria-label` value                          |
|---------------------------------|---------------------------------------------|
| GitHub star button (nav)        | `"Star Nitro-Fueled on GitHub"`             |
| Mobile hamburger toggle button  | `"Open navigation menu"` / `"Close navigation menu"` (toggled via JS) |
| Copy install command button     | `"Copy install command to clipboard"`       |
| GitHub link in footer           | `"Nitro-Fueled on GitHub (opens in new tab)"` |
| Pipeline arrow spans            | `aria-hidden="true"` (decorative)           |
| Ambient blob divs               | `aria-hidden="true"`                        |

### 7.5 Skip Navigation Link

Add as the first child of `<body>`:

```html
<a href="#main-content"
   class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-nitro-orange focus:text-nitro-bg focus:px-4 focus:py-2 focus:rounded-md focus:font-semibold">
  Skip to main content
</a>
```

Add `id="main-content"` to the `<main>` element wrapping sections 2–10.

### 7.6 External Links

All external links (`github.com`) must include:
- `target="_blank"`
- `rel="noopener noreferrer"`
- Visual indicator that it opens in a new tab (either via an icon or the aria-label mentions "opens in new tab")

### 7.7 Motion Sensitivity

Already covered in Section 4.8. Ensure the `prefers-reduced-motion` media query is in place so users with vestibular disorders are not affected by parallax, float, or counter animations.

---

## 8. Responsive Breakpoints

### 8.1 Breakpoint Summary

Using Tailwind's default breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

### 8.2 Per-Section Breakpoint Behavior

| Section           | 1440px (default)          | 1024px              | 768px (md)              | 375px (sm)                  |
|-------------------|---------------------------|---------------------|-------------------------|-----------------------------|
| Nav               | Full with center links    | Full with center links | Center links hidden, hamburger shown | Hamburger only |
| Hero              | Full blobs, large H1      | Reduced font        | CTA buttons stack vertical | Pipeline wraps to 2 rows  |
| Pain points (§3)  | 3-column grid             | 3-column grid       | 1-column stack          | 1-column stack              |
| Solution (§4)     | 3-column grid             | 3-column grid       | 1-column stack          | 1-column stack              |
| How It Works (§5) | Full rows, icon visible   | Full rows           | Full rows               | Icon hidden if space tight  |
| Get Started (§6)  | 2 columns                 | 2 columns           | 1 column                | 1 column                    |
| Existing (§7)     | 60% width content         | Full width          | Full width              | Full width                  |
| Features (§8)     | 3-column grid             | 2-column grid       | 2-column grid           | 1-column stack              |
| Sample Task (§9)  | Full width code block     | Full width          | Full width, scrollable  | Scrollable, smaller font    |
| CTA (§10)         | Centered, full width band | Centered            | Buttons stack vertically| Buttons stack vertically    |
| Footer            | 2-column layout           | 2-column            | Stacked                 | Stacked                     |

### 8.3 Typography at Mobile

At 375px, the hero H1 clamp floor (`42px`) may be too large for some phones. Override:
```css
@media (max-width: 480px) {
  .hero-h1 {
    font-size: 36px;
    letter-spacing: -1.5px;
  }
  .hero-tagline {
    font-size: 15px;
  }
}
```

### 8.4 Code Block on Mobile

Code blocks must be horizontally scrollable on mobile — never break words:
```css
.code-block pre {
  white-space: pre;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

---

## 9. Implementation Order Recommendation

The developer should implement sections in this order for efficient testing at each step:

1. Tailwind config extension (add all custom colors)
2. Global CSS (reset, keyframes, custom classes: `fade-in`, `nav-solid`, `code-block`)
3. Document shell (html, head, body, blob divs, skip link)
4. Navigation (sticky, transparent/solid, hamburger)
5. Hero section (all sub-components: badge, h1, tagline, CTAs, pipeline, stats)
6. Section 3 + 4 (pain points + solution — same card pattern)
7. Section 5 (how it works — numbered steps)
8. Section 6 + 7 (new project + existing project — similar layout)
9. Section 8 (features grid)
10. Section 9 (sample task code block — largest code block)
11. Section 10 (CTA band)
12. Footer
13. Script block (nav scroll, fade-in observer, counter, clipboard, hamburger)
14. Responsive polish pass
15. Accessibility pass (focus rings, aria-labels, contrast check)

---

## 10. File Checklist for Developer

Before finishing, verify:

- [ ] `packages/docs/tailwind.config.mjs` — all 12 custom color tokens added
- [ ] `packages/docs/src/pages/index.astro` — all 11 sections present, no placeholder text
- [ ] All `href` values use `base` variable from `import.meta.env.BASE_URL`
- [ ] `<html class="dark" style="background:#0a0e17">` to prevent flash
- [ ] Inter font loaded via Google Fonts or local import
- [ ] `<script>` block at bottom with all 5 behaviors (nav, fade-in, counter, clipboard, hamburger)
- [ ] `prefers-reduced-motion` media query in CSS
- [ ] Focus-visible ring CSS in global styles
- [ ] All external links have `target="_blank" rel="noopener noreferrer"`
- [ ] Skip navigation link present
- [ ] Code blocks have `white-space: pre; overflow-x: auto` for mobile
- [ ] `npx astro check` passes with no type errors
- [ ] `npm run build` builds cleanly
