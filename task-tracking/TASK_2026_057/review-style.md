# Code Style Review — TASK_2026_057

## Review Summary

| Metric          | Value                                |
| --------------- | ------------------------------------ |
| Overall Score   | 6/10                                 |
| Assessment      | NEEDS_REVISION                       |
| Critical Issues | 3                                    |
| Major Issues    | 5                                    |
| Minor Issues    | 6                                    |
| Files Reviewed  | 13                                   |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The mermaid diagrams in `concepts/index.md` and `concepts/tasks.md` render as plain code blocks, not visual diagrams, because no mermaid plugin is configured in `astro.config.mjs`. When the architecture becomes more complex and these diagrams need updating, editors will see raw Mermaid syntax in a code box and assume it is working — it is not. The task spec explicitly stated "Starlight supports them" but the built output confirms they are displayed as highlighted text.

The command count claim in `getting-started/installation.md` says "15 slash commands installed" but only 11 slash commands are documented in `commands/index.md`. The actual `.claude/commands/` directory has 17 files. As new commands are added, this number will drift further and no one will catch it.

### 2. What would confuse a new team member?

`getting-started/index.md` line 29 contains a self-contradictory statement: "The `session-orchestrator` MCP server lives in a separate repository and is a **required dependency for Auto-Pilot and `/orchestrate` commands**. Manual task runs via the slash commands work without it." `/orchestrate` IS a slash command. A new user reading this will not understand whether they need the MCP server to run `/orchestrate` or not. The correct distinction is: spawning workers in new iTerm2 tabs requires the MCP server; running a pipeline in the current Claude Code session does not.

The `concepts/index.md` opening sentence (line 6) uses lowercase for all layer names ("a **supervisor**, a **planner**") but the rest of the document and every other file consistently capitalizes these as proper nouns. A new reader's first impression will be inconsistent with what they read everywhere else.

### 3. What's the hidden complexity cost?

The docs use plain Markdown blockquotes (`> **Note:**`, `> **Tip:**`) throughout instead of Starlight's native callout syntax (`:::note`, `:::tip`). The task spec explicitly required using Starlight callouts. The plain blockquotes work, but they miss Starlight's styled aside components — they render as plain indented text without icons or color coding. This is a systemic pattern across at least 7 instances found in `first-run.md`, `installation.md`, and `examples/new-project.md`. Fixing this later will require touching every file.

### 4. What pattern inconsistencies exist?

**Pre-flight validation step counts:** `concepts/supervisor.md` lists 5 pre-flight checks; `auto-pilot/index.md` lists 6 (adds "task-tracking/ directory is writable"). Both pages describe the same feature. A user who reads the supervisor concept page and then the auto-pilot guide will see different information with no explanation of why they differ.

**Agent count vs documented commands:** `agents/index.md` references `nitro-fueled update` as the mechanism to refresh core agents (line 6), but `commands/index.md` does not document `npx nitro-fueled update`. The `update.ts` command file exists in the CLI source. It is documented nowhere in the user-facing docs.

**Monitoring interval inconsistency:** `concepts/supervisor.md` states the monitoring interval default is 10 minutes (line 40 and table). `auto-pilot/index.md` configuration table also shows 10 minutes. The task spec at line 126 says "default 5 min" for monitoring interval. The docs are consistent with each other but conflict with the task spec — one of these is wrong.

### 5. What would I do differently?

The "worker types" section in `concepts/workers.md` describes only Build Workers and Review Workers. The task spec (line 59) asked for three types including "Cleanup Worker," which is absent from the docs entirely. Either the spec was wrong and Cleanup Workers don't exist, or this is a content gap. The docs silently drop it — there is no acknowledgment that this type was considered and excluded.

The task spec required using Starlight's `<Steps>`, `<Card>`, and `<CardGrid>` components for installation procedures and feature lists. None of the 13 pages use any JSX components. The installation guide's numbered steps are plain bold text headers instead of `<Steps>` components. This is a functional miss, not a style preference — the spec mandated these components explicitly.

---

## Critical Issues

### Issue 1: Mermaid Diagrams Render as Code Blocks, Not Diagrams

- **Files**: `concepts/index.md:12`, `concepts/tasks.md:37`
- **Problem**: Both files use ```` ```mermaid ```` fenced code blocks. No mermaid plugin (`remark-mermaid`, `rehype-mermaid`, or Starlight's experimental mermaid support) is configured in `astro.config.mjs`. The built `dist/concepts/index.html` confirms the content is rendered as `<pre data-language="mermaid">` — a syntax-highlighted code block, not a rendered diagram.
- **Impact**: The architecture flowchart and state machine diagram are the most important visual content in the Core Concepts section. Both are currently invisible to readers as diagrams. A first-time reader sees raw Mermaid syntax.
- **Fix**: Either add a mermaid plugin (e.g., `astro-mermaid` or configure `markdown.remarkPlugins` with `remark-mermaid`), or replace both diagrams with static SVG images, or replace with a ASCII/text representation that is intentionally code.

---

### Issue 2: Slash Command Count Is Wrong in Two Places

- **Files**: `getting-started/installation.md:28`, `examples/new-project.md:43`, `examples/existing-project.md:64`
- **Problem**: Installation.md line 28 claims "Copies all 22 core agents" — this is correct. But the example output on line 42 of new-project.md shows "15 slash commands installed." The actual `.claude/commands/` directory has 17 command files. The `commands/index.md` documents only 11 slash commands. The number 15 is wrong by any count: 17 actual files, 11 documented, 15 claimed in examples.
- **Impact**: A user who runs `npx nitro-fueled init` and sees "15 slash commands installed" then reads `commands/index.md` and finds only 11 will either think the docs are wrong or the installer is broken.
- **Fix**: Audit the actual command count and make all three locations consistent. The commands/index.md also needs to document the 6 undocumented commands: `/create`, `/create-agent`, `/create-skill`, `/evaluate-agent`, `/orchestrate-help`, and `/status` (which is an alias for `/project-status`). `npx nitro-fueled update` is also undocumented.

---

### Issue 3: Self-Contradictory MCP Server Dependency Note

- **File**: `getting-started/index.md:29`
- **Problem**: The note states the MCP server is "a required dependency for Auto-Pilot and `/orchestrate` commands" then immediately says "Manual task runs via the slash commands work without it." `/orchestrate` is itself a slash command. The statement declares it both required and not required.
- **Impact**: New users trying to determine whether they must set up `session-orchestrator` before doing anything will get contradictory guidance from the first page they read.
- **Fix**: The correct distinction is: features that spawn workers in new iTerm2 tabs (`/auto-pilot`, `npx nitro-fueled run`) require the MCP server; features that run pipelines in the current Claude Code session (`/orchestrate TASK_ID` in the current window) do not.

---

## Major Issues

### Issue 1: Starlight Callout Components Not Used (Task Spec Requirement Missed)

- **Files**: All 13 files
- **Problem**: The task spec explicitly required using Starlight callout syntax (`:::note`, `:::tip`, `:::caution`). All callouts across all 13 pages use plain Markdown blockquotes (`> **Note:**`, `> **Tip:**`). Count: at least 8 blockquote callouts found across `getting-started/index.md`, `installation.md`, `first-run.md`, and `examples/new-project.md`. None use the Starlight component format.
- **Tradeoff**: Plain blockquotes render and are readable. But they produce unstyled text, no icons, no color-coded severity levels. Users cannot visually distinguish tips from warnings.
- **Recommendation**: Convert all `> **Note:**` and `> **Tip:**` instances to `:::note` and `:::tip` syntax before publishing. This is a full-file touch across all 13 pages.

---

### Issue 2: Pre-Flight Validation Step Count Differs Between Two Pages

- **Files**: `concepts/supervisor.md:62–70`, `auto-pilot/index.md:50–58`
- **Problem**: `concepts/supervisor.md` lists 5 pre-flight checks. `auto-pilot/index.md` lists 6 checks (adds `task-tracking/` directory is writable). The pages describe the same feature.
- **Tradeoff**: If the extra check is real, the concepts page is incomplete. If it is aspirational, the auto-pilot guide is ahead of implementation.
- **Recommendation**: Reconcile the two lists. The auto-pilot guide is more detailed and likely more accurate — update the supervisor concepts page to match it.

---

### Issue 3: `npx nitro-fueled update` Is Undocumented

- **Files**: `commands/index.md`, `agents/index.md:6`
- **Problem**: `agents/index.md` references `nitro-fueled update` as the mechanism to refresh core agents. The CLI source has `update.ts`. The commands reference does not cover it — no section, no entry in the summary table.
- **Tradeoff**: Users who want to update their Nitro-Fueled installation have no documented path. They may re-run `init` unnecessarily.
- **Recommendation**: Add an `npx nitro-fueled update` section to `commands/index.md` and the summary table.

---

### Issue 4: Starlight `<Steps>`, `<Card>`, and `<CardGrid>` Components Not Used

- **Files**: `getting-started/installation.md`, `concepts/index.md`, `getting-started/index.md`
- **Problem**: The task spec explicitly required `<Steps>` for numbered procedures and `<Card>`/`<CardGrid>` for feature lists. Installation.md uses bold-text "1.", "2.", "3." headings for steps instead of `<Steps>`. The overview page uses a plain table for "Where to Go Next" instead of `<CardGrid>`. These components require `.mdx` file extension — none of the files are `.mdx`.
- **Tradeoff**: The pages work fine as `.md` with plain lists. But the task spec is explicit and the Starlight components produce significantly better UX for step-by-step content.
- **Recommendation**: Convert pages with numbered procedures (`installation.md`, `first-run.md`) to `.mdx` and use `<Steps>`. Convert the overview page to use `<CardGrid>` for the "Where to Go Next" section. Update `astro.config.mjs` sidebar slugs accordingly when renaming.

---

### Issue 5: Cleanup Worker Omitted Without Explanation

- **File**: `concepts/workers.md`
- **Problem**: The task spec (line 59) specifically requested documentation of three worker types: "Build Worker, Review Worker, Cleanup Worker." The docs cover only Build Worker and Review Worker. There is no mention of Cleanup Worker anywhere in the 13 pages — not even to say it does not exist yet or was renamed.
- **Tradeoff**: Either the Cleanup Worker concept was dropped from the design (in which case the task spec is outdated) or it exists and was omitted (content gap).
- **Recommendation**: Clarify with the implementer. If the Cleanup Worker does not exist, note its absence or remove the spec reference. If it exists, document it.

---

## Minor Issues

1. **`concepts/index.md:6` — lowercase "supervisor" and "planner"** in the opening sentence. Every other use in every page capitalizes these as proper nouns ("Supervisor", "Planner"). File:line `concepts/index.md:6`.

2. **`agents/index.md:274` — lowercase "supervisor"** in the See Also description: "How agents fit into the worker and supervisor architecture." All other references are capitalized. File:line `agents/index.md:274`.

3. **`getting-started/installation.md:100` — session-orchestrator GitHub URL** points to `https://github.com/iamb0ody/session-orchestrator`. This is a private/personal account URL. If the repository is not public, this link will 404 for all readers. Verify the repository is public before publishing.

4. **`examples/new-project.md:36`, `examples/existing-project.md:58` — version placeholder "v1.x"** in the simulated init output. The actual package version is `0.1.0`. The `v1.x` placeholder is illustrative, but "v0.1.0" would be more accurate and less misleading.

5. **`concepts/tasks.md:144–149` — Priority table shows bare codes** ("P0", "P1", "P2", "P3") as the value column, while `task-format/index.md:42–45` shows the compound format ("P0-Critical", "P1-High"). Both are describing the same field. The format difference will confuse users about whether to write `P1` or `P1-High` in their task files.

6. **`auto-pilot/index.md:73` — Dependencies example includes both a real dependency and "None"** in the same list block, which is inconsistent with the format shown everywhere else. The sample shows:
   ```
   - TASK_2026_003 — database schema...
   - TASK_2026_005 — auth service...
   - None
   ```
   Mixing a real dependency with "None" as a list item is confusing. "None" is the value when there are no dependencies, not an additional entry alongside real ones.

---

## File-by-File Analysis

### `getting-started/index.md`

**Score**: 6/10
**Issues Found**: 1 critical, 1 minor

The page is clean and well-organized. The key features table is useful. **Critical**: the MCP server note is self-contradictory (see Critical Issue 3). **Minor**: no callout components used.

### `getting-started/installation.md`

**Score**: 6/10
**Issues Found**: 1 critical, 1 major, 1 minor

Well-structured. The tech stack detection table is genuinely useful. **Critical**: the slash command count is wrong. **Major**: `<Steps>` component not used for numbered procedures despite spec requirement. The `session-orchestrator` GitHub URL points to a personal account repo — verify it is public.

### `getting-started/first-run.md`

**Score**: 7/10
**Issues Found**: 1 major

The step-by-step walkthrough is detailed and practical. The artifacts table is excellent. **Major**: plain blockquote callouts instead of Starlight callout components.

### `concepts/index.md`

**Score**: 6/10
**Issues Found**: 1 critical, 1 minor

The architecture diagram intent is good but the mermaid block does not render. The five-layers breakdown is clear. **Critical**: mermaid diagram renders as code. **Minor**: lowercase "supervisor" and "planner" in opening sentence contradicts capitalization in the rest of the document.

### `concepts/tasks.md`

**Score**: 6/10
**Issues Found**: 1 critical, 1 minor

The state machine description is thorough. The `task.md` format example is clean. **Critical**: mermaid state diagram renders as code. **Minor**: Priority table uses bare codes (P0/P1) instead of the compound format (P0-Critical/P1-High) used everywhere else.

### `concepts/workers.md`

**Score**: 6/10
**Issues Found**: 1 major

The health states table and two-strike detection section are genuinely good reference content. **Major**: Cleanup Worker is missing — the task spec called for three worker types.

### `concepts/supervisor.md`

**Score**: 7/10
**Issues Found**: 1 major

The 9-step control loop is well explained and useful. **Major**: pre-flight validation lists only 5 checks versus 6 in `auto-pilot/index.md`.

### `task-format/index.md`

**Score**: 8/10
**Issues Found**: 0 critical, 0 major, 0 minor

The best page in the set. The consumer table, the good/bad task comparison, and the annotated FEATURE example are all excellent. The content is specific and actionable. The only finding is the cosmetic one about the bad task example missing a blank line after `## Metadata` before the table (inside a code block, so irrelevant to rendering).

### `commands/index.md`

**Score**: 5/10
**Issues Found**: 1 critical, 1 major

The documented commands are well-formatted and useful. **Critical**: 6 commands exist in the actual `.claude/commands/` directory that are not documented here: `/create`, `/create-agent`, `/create-skill`, `/evaluate-agent`, `/orchestrate-help`, `/status`. **Major**: `npx nitro-fueled update` is not documented.

### `agents/index.md`

**Score**: 7/10
**Issues Found**: 1 minor

The roster table and individual agent entries are consistent and well-structured. The inputs/outputs pattern is applied uniformly. **Minor**: lowercase "supervisor" in the See Also description (line 274).

### `auto-pilot/index.md`

**Score**: 8/10
**Issues Found**: 1 major

Strong reference page. The orchestrator-state.md example with actual data is particularly useful. File overlap detection is well explained and it's the only page that covers it. **Major**: pre-flight validation lists 6 checks while `concepts/supervisor.md` lists 5 — one of the two is wrong.

### `examples/new-project.md`

**Score**: 7/10
**Issues Found**: 1 critical, 1 minor

The dependency wave execution trace is excellent — showing the actual console output makes the parallel execution model concrete. **Critical**: "15 slash commands installed" is wrong. **Minor**: "v1.x" version placeholder should be "v0.1.0".

### `examples/existing-project.md`

**Score**: 8/10
**Issues Found**: 1 critical, 1 minor

The most realistic example in the set. The BUGFIX pipeline trace showing phase skipping is genuinely instructive. The completion report detail is useful. **Critical**: "15 slash commands installed" is wrong. **Minor**: "v1.x" version placeholder.

---

## Pattern Compliance

| Pattern                              | Status | Concern                                              |
| ------------------------------------ | ------ | ---------------------------------------------------- |
| Valid frontmatter (title, description) | PASS | All 13 pages have both fields                       |
| No TODO/placeholder content          | PASS   | No TODO strings found                                |
| Mermaid diagrams render              | FAIL   | No mermaid plugin configured; renders as code blocks |
| Starlight callout components         | FAIL   | All callouts use plain blockquotes                   |
| Starlight Steps/Card components      | FAIL   | No .mdx files, no JSX components used               |
| Internal link paths resolve          | PASS   | All relative links tested against built output       |
| Consistent terminology               | PARTIAL | "supervisor"/"Supervisor" inconsistent in 2 places  |
| Command inventory accurate           | FAIL   | Documented count (11) ≠ actual count (17)            |
| Cross-page consistency               | PARTIAL | Pre-flight check count differs between 2 pages      |

---

## Technical Debt Assessment

**Introduced:**
- Mermaid blocks without rendering support will silently degrade as diagrams are added to more pages
- Plain blockquotes instead of Starlight asides creates a systemic rework task
- Command count drift will worsen as new commands are added

**Mitigated:**
- All stub pages have been replaced with real content — this was the primary debt from TASK_2026_055
- Cross-links between pages are correct and verified against the built site

**Net Impact:** Neutral to slight negative. Content quality is good; structural compliance with the task spec is incomplete. The mermaid and component issues are structural, not cosmetic.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The two mermaid diagrams — the architecture flowchart and the state machine — are the visual anchors for the entire Concepts section. Both are broken in the current build. A new user landing on Core Concepts will see two large blocks of raw text where diagrams should be.

---

## What Excellence Would Look Like

A 9/10 implementation would have:
1. A mermaid plugin configured and diagrams rendering as interactive SVGs in the built site
2. All callouts using `:::note` / `:::tip` / `:::caution` syntax with proper Starlight styling
3. `getting-started/installation.md` and `first-run.md` converted to `.mdx` using `<Steps>` for numbered procedures
4. `commands/index.md` documenting all 17 command files with accurate counts
5. `npx nitro-fueled update` documented in the CLI commands section
6. Cleanup Worker documented or explicitly noted as "planned but not yet implemented"
7. Pre-flight validation counts reconciled between `concepts/supervisor.md` and `auto-pilot/index.md`
8. The MCP server dependency note rewritten to clearly explain which features require it and which do not
