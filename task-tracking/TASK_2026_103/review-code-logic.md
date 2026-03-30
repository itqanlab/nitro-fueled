# Code Logic Review — TASK_2026_103

## Review Summary

| Metric              | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| Overall Score       | 6/10                                                        |
| Assessment          | NEEDS_REVISION                                              |
| Critical Issues     | 0                                                           |
| Serious Issues      | 3                                                           |
| Moderate Issues     | 2                                                           |
| Failure Modes Found | 4                                                           |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The keyword detection table in SKILL.md lists `brand identity` under the DESIGN keyword row. The same term also appears in the CREATIVE section of `strategies.md` as a valid CREATIVE trigger ("UI themes, component library design, marketing pages, brand identity"). Because the priority order (`DEVOPS > OPS > DESIGN > CREATIVE`) is only stated in `SKILL.md` and not repeated in `strategies.md`'s decision tree or in `agent-catalog.md`'s Agent Selection Matrix, an orchestrator reading only `strategies.md` or the catalog would not encounter the disambiguation rule and could route "brand identity" to CREATIVE without asking the clarifying question. The failure is silent: the orchestrator selects CREATIVE and no error is raised — the user just ends up in the wrong pipeline.

### 2. What user action causes unexpected behavior?

A user who says "design our homepage" is explicitly called out in the DESIGN disambiguation table as mapping to CREATIVE ("implies implementation"). However, the CREATIVE keyword row in SKILL.md's Workflow Selection Matrix does NOT contain "homepage" or "design our" as a trigger keyword — it only has "landing page, marketing, brand, visual". That phrase will match the DESIGN keyword row first because DESIGN has higher priority and "design" is a substring match candidates. The user wanted CREATIVE, gets DESIGN, and never sees the clarifying question (because the system chose confidently without reaching ambiguity). The disambiguation note about asking only applies when it IS ambiguous — but the system will classify it as DESIGN without triggering the ambiguity check.

### 3. What data makes this produce wrong results?

The `brand identity` keyword conflict is the clearest data failure:
- Input: "Create brand identity guidelines for our product"
- Expected route: DESIGN (no code output, pure identity spec)
- SKILL.md behavior: DESIGN keyword row matches `brand identity` — routes correctly here
- `strategies.md` CREATIVE section "When to use" description includes "brand identity" — an orchestrator using strategies.md alone to validate routing would see CREATIVE as valid and question the decision

Additionally: the DESIGN decision tree node in `strategies.md` reads "Is task DESIGN (wireframe, prototype, design system, brand identity — no code output)?". The parenthetical qualifies brand identity as DESIGN-only. But the CREATIVE node immediately below reads "Is task CREATIVE (landing page, brand, marketing, theme design — includes code output)?". The bare word `brand` under CREATIVE creates ambiguity for any task that contains only the word "brand" without "identity" — that task would first fail to match DESIGN (because "brand" alone is not in the DESIGN trigger list) and then match CREATIVE via the `brand` keyword, even if no code was requested.

### 4. What happens when dependencies fail?

This is a documentation/specification system — the "dependencies" are other orchestration agents following the spec. Failure modes:

- **nitro-project-manager Triggers section not updated**: `agent-catalog.md` lists nitro-project-manager Triggers as covering FEATURE, DOCUMENTATION, DEVOPS, CONTENT strategies. DESIGN is not listed as a trigger for nitro-project-manager, even though the DESIGN pipeline's first phase is PM. An orchestrator that looks at the PM agent's trigger list to decide if it should invoke PM will find no DESIGN entry, and may skip the PM phase or invoke a different planning agent.

- **nitro-code-style-reviewer selection for DESIGN QA**: The QA Choice checkpoint (Checkpoint 3) in `checkpoints.md` offers the options `tester / style / logic / reviewers / all / skip`. The DESIGN QA review section in `strategies.md` specifies `nitro-code-style-reviewer`. But an orchestrator choosing "reviewers" at the QA Choice checkpoint will invoke BOTH `nitro-code-style-reviewer` AND `nitro-code-logic-reviewer` in parallel. `nitro-code-logic-reviewer` is a code logic reviewer designed for source code, not for design documents. The specification does not state that the "reviewers" option should be scoped to style-only for DESIGN, and does not warn the orchestrator to restrict QA choice options for DESIGN tasks. A user who picks "reviewers" on a DESIGN task gets an inappropriate code logic review applied to their wireframe document.

### 5. What's missing that the requirements didn't mention?

- **Phase Detection table in SKILL.md is not updated for DESIGN**: The CONTINUATION phase detection table maps "documents present" to "next action". It is written around PM→Architect→Team-Leader→QA. For DESIGN tasks that skip the Architect phase, there is no phase detection row that says "task-description.md present + task type is DESIGN → invoke nitro-ui-ux-designer". An orchestrator resuming a DESIGN task mid-flow would see `task-description.md` present and follow the default path: invoke the Architect. This is a latent routing error that will surface the first time a DESIGN task is resumed after an interrupted PM phase.

- **SKILL.md description field not updated**: The SKILL.md front-matter description still says "Use when: (1) Implementing new features, (2) Fixing bugs, (3) Refactoring code, (4) Creating documentation, (5) Research & investigation, (6) DevOps/infrastructure, (7) Landing pages and marketing content." DESIGN is not enumerated. This is the entry-point description used by the Skill router — if a user asks for a wireframe the router may select a different skill entirely.

- **No example trace for DESIGN workflow**: `strategies.md` and `SKILL.md` both include example traces for FEATURE, BUGFIX, and CREATIVE. There is no `design-trace.md` example. The CREATIVE trace exists, which is the closest analogous flow, but its dependency on design system check and content-writer does not match DESIGN at all. Absence of an example trace increases the chance of misrouting during first real use.

---

## Failure Mode Analysis

### Failure Mode 1: Brand Identity Routed to CREATIVE

- **Trigger**: User request contains "brand identity" alone, without other DESIGN-specific qualifiers
- **Symptoms**: System routes to CREATIVE, invokes content writer, produces landing page content rather than design spec. User gets a full creative pipeline instead of a design-only one.
- **Impact**: Wrong agents invoked, wrong artifacts produced, wasted pipeline run
- **Current Handling**: Priority order (`DESIGN > CREATIVE`) is stated in SKILL.md. But `strategies.md` CREATIVE "When to use" still lists "brand identity" — cross-referencing documents is inconsistent.
- **Recommendation**: Remove "brand identity" from CREATIVE's "When to use" description in `strategies.md`, or explicitly note it is subordinate to DESIGN when no code output is requested.

### Failure Mode 2: Resume of DESIGN Task Invokes Architect Incorrectly

- **Trigger**: A DESIGN task is interrupted after PM phase (task-description.md present, no plan.md). User resumes with `/orchestrate TASK_X`.
- **Symptoms**: Phase detection table has "task-description.md → User validate OR invoke architect". The orchestrator invokes `nitro-software-architect` because it cannot distinguish a DESIGN task from a FEATURE task at the phase detection level. The architect produces a `plan.md` with a technical implementation plan, which is meaningless for a design-only task.
- **Impact**: Incorrect agent invoked, wrong artifact produced, task derails.
- **Current Handling**: Not handled. The phase detection table has no strategy-aware branching.
- **Recommendation**: Add a strategy-aware condition to the phase detection table: when task type is DESIGN and task-description.md is present, the next action is "invoke nitro-ui-ux-designer", not architect.

### Failure Mode 3: nitro-project-manager Not Recognized as DESIGN Phase Agent

- **Trigger**: Any orchestrator or agent consulting agent-catalog.md to determine which agents participate in DESIGN flow, specifically looking at the nitro-project-manager Triggers list.
- **Symptoms**: PM is not invoked for DESIGN tasks. nitro-ui-ux-designer is invoked directly without a requirements phase. The designer receives no task-description.md to work from.
- **Impact**: Missing requirements document; designer has no formal brief; PM-validated scope checkpoint is skipped.
- **Current Handling**: Agent Selection Matrix row "Design artifacts" correctly lists `nitro-project-manager -> nitro-ui-ux-designer -> nitro-code-style-reviewer`. But the nitro-project-manager Triggers section (used to understand what workflows invoke it) does not list DESIGN.
- **Recommendation**: Add "DESIGN tasks (Phase 1)" to the nitro-project-manager Triggers list in agent-catalog.md.

### Failure Mode 4: Inappropriate QA Agent Applied to Design Documents

- **Trigger**: User selects "reviewers" or "all" at Checkpoint 3 QA Choice for a DESIGN task.
- **Symptoms**: `nitro-code-logic-reviewer` is invoked on a `.md` design spec file. The agent is calibrated for code logic completeness — it will apply code-specific criteria (algorithm correctness, error handling, edge cases) to a wireframe document, producing a misleading or empty review.
- **Impact**: QA phase produces noise or false findings; may cause Fix Worker to attempt nonsensical code fixes on a markdown document.
- **Current Handling**: No restriction on QA choice options for DESIGN tasks. Checkpoint 3 template is generic across all strategies.
- **Recommendation**: Add a strategy-specific QA guidance note for DESIGN in checkpoints.md and/or SKILL.md: for DESIGN tasks, valid QA options are `style` or `skip` only.

---

## Critical Issues

None identified. No logic path produces data loss or complete pipeline failure in the happy path.

---

## Serious Issues

### Issue 1: nitro-project-manager Triggers Section Missing DESIGN

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/agent-catalog.md` — nitro-project-manager Triggers section (line ~67)
- **Scenario**: Orchestrator or another agent reads agent-catalog.md to understand which agents are relevant to a DESIGN task. PM trigger list omits DESIGN.
- **Impact**: PM may be skipped for DESIGN tasks; no task-description.md produced; designer runs without a validated brief.
- **Fix**: Add "DESIGN tasks (Phase 1)" to the nitro-project-manager Triggers list.

### Issue 2: Phase Detection Table in SKILL.md is Strategy-Blind

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md` — CONTINUATION Phase Detection table (line ~209)
- **Scenario**: DESIGN task is resumed after PM phase. Phase detection reads "task-description.md present → invoke architect". Architect is wrong for DESIGN.
- **Impact**: Architect invoked on a design-only task, producing a code implementation plan where none is needed.
- **Fix**: Add a strategy-aware branch: when task type is DESIGN and task-description.md is present, next action is "invoke nitro-ui-ux-designer, NOT architect". Can be implemented as a conditional note in the phase detection table or as a pre-flight check before phase detection runs.

### Issue 3: QA Choice Not Restricted for DESIGN Tasks

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/checkpoints.md` — Checkpoint 3 QA Choice (line ~219) and `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/strategies.md` — DESIGN Review Criteria section (line ~738)
- **Scenario**: User selects "reviewers" or "all" for a DESIGN task's QA phase.
- **Impact**: `nitro-code-logic-reviewer` and/or `nitro-senior-tester` invoked on markdown design artifacts.
- **Fix**: Add a note in checkpoints.md Checkpoint 3 and in DESIGN's review criteria section: "For DESIGN tasks, only `style` or `skip` are applicable QA options."

---

## Moderate Issues

### Issue 4: SKILL.md Front-Matter Description Omits DESIGN

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/SKILL.md` — front-matter description (lines 3–8)
- **Scenario**: Skill router evaluates whether this skill is relevant to a wireframe or design request. The description enumerates 7 use cases; design-only work is not listed.
- **Impact**: Skill may not be selected for pure design tasks.
- **Fix**: Add "(8) UI/UX design, wireframes, design systems, brand identity" to the skill description.

### Issue 5: `brand` Bare Keyword Conflict Between DESIGN Decision Tree and CREATIVE Keyword Row

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/orchestration/references/strategies.md` — CREATIVE "When to use" (line ~338) and DESIGN decision tree (line ~773)
- **Scenario**: CREATIVE's `When to use` section lists "brand identity" as a CREATIVE trigger. DESIGN's decision tree lists "brand identity" under DESIGN. The two specifications are inconsistent about ownership of the `brand identity` keyword.
- **Impact**: Ambiguity when reading strategies.md in isolation. An LLM following strategies.md top-to-bottom may treat CREATIVE's "brand identity" mention as authoritative because CREATIVE appears before DESIGN in the file.
- **Fix**: Remove "brand identity" from the CREATIVE "When to use" description, or add a cross-reference note: "brand identity routes to DESIGN unless code implementation is also requested."

---

## Data Flow Analysis

```
User Request
    |
    v
SKILL.md — Keyword Detection Table
    |
    | DESIGN matched (if "design system", "wireframe", etc.)
    v
Strategy: DESIGN
    |
    v
[NEW TASK] Context.md written
    |
    v
[CHECKPOINT 0 — Scope Clarification: Yes]
    |
    v
nitro-project-manager invoked
    |  <-- GAP: PM Triggers in agent-catalog.md doesn't list DESIGN
    v
task-description.md written
    |
    v
[CHECKPOINT 1 — Requirements Validation: Yes]
    |
    v
[CONTINUATION PHASE DETECTION — GAP: strategy-blind, would invoke Architect here]
    |
    | (correct path skips Architect)
    v
nitro-ui-ux-designer invoked
    |
    v
design artifacts written
    |
    v
handoff.md written
    |
    v
[CHECKPOINT 3 — QA Choice: Yes]
    |  <-- GAP: "reviewers" / "all" options not restricted for DESIGN
    v
nitro-code-style-reviewer reviews design spec
    |
    v
[CHECKPOINT 5 — Completion: Yes]
    |
    v
Task COMPLETE
```

Gap Points Identified:
1. Phase detection is not strategy-aware — DESIGN tasks resumed mid-flow will route to Architect
2. PM trigger list incomplete — PM may be bypassed for DESIGN
3. QA choice unrestricted — code logic reviewer can be applied to markdown design docs
4. SKILL.md front-matter description does not enumerate design work as a use case

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| DESIGN type in task-template.md Type enum | COMPLETE | Was already present before this task ran |
| strategies.md has DESIGN workflow diagram with phase descriptions | COMPLETE | Full section added |
| Orchestration SKILL.md routes DESIGN type to correct pipeline | PARTIAL | Keyword table and priority correct; phase detection not strategy-aware |
| Keyword detection triggers DESIGN for design-only keywords | COMPLETE | All target keywords present |
| DESIGN vs CREATIVE disambiguation documented and enforced in keyword priority | PARTIAL | Priority order enforced in SKILL.md; strategies.md CREATIVE section still lists "brand identity" creating cross-document inconsistency |
| checkpoints.md checkpoint matrix includes DESIGN row | COMPLETE | Row present with correct profile |
| agent-catalog.md maps agents to DESIGN flow | PARTIAL | Agent Selection Matrix row added; nitro-project-manager Triggers section not updated |

### Implicit Requirements NOT Addressed:
1. Phase detection needs strategy-aware branching for DESIGN so resumed tasks do not invoke the Architect
2. QA choice options should be scoped per strategy — code logic review is not valid for design artifacts
3. SKILL.md front-matter description should enumerate DESIGN as a supported workflow so the skill is correctly selected by the router

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| User says "design and build our homepage" | YES | Disambiguation rule routes to CREATIVE | Correct |
| User says "brand identity guidelines" | PARTIAL | DESIGN keyword matches `brand identity` | CREATIVE "When to use" in strategies.md also lists it — cross-document inconsistency |
| User says "design our brand" (bare "brand") | NO | "brand" matches CREATIVE keyword row; DESIGN decision tree requires "brand identity" not bare "brand" | Routes to CREATIVE incorrectly |
| DESIGN task resumed after PM phase | NO | Phase detection invokes Architect regardless of task type | See Serious Issue 2 |
| User selects "all" at QA Choice for DESIGN task | NO | code-logic-reviewer invoked on design doc | See Serious Issue 3 |
| User says "UI design for checkout" | YES | "UI design" triggers DESIGN correctly | No concern |
| Task type DESIGN with no prior design system | YES | nitro-ui-ux-designer creates it as primary output | Correct |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| SKILL.md keyword routing -> DESIGN | LOW | Correct keywords listed | None needed |
| Phase detection -> DESIGN task resumed | HIGH | Architect invoked incorrectly | Fix phase detection table |
| agent-catalog.md PM Triggers -> DESIGN | MEDIUM | PM skipped | Add DESIGN to PM triggers |
| checkpoints.md QA Choice -> DESIGN | MEDIUM | Wrong QA agent on design doc | Add DESIGN-specific QA restriction |
| strategies.md CREATIVE "brand identity" cross-reference | MEDIUM | Inconsistent routing across docs | Remove brand identity from CREATIVE description |

---

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Top Risk**: Phase detection in SKILL.md is strategy-blind — any DESIGN task resumed after PM completion will incorrectly invoke the Software Architect, derailing the pipeline.

---

## Fixes Required

### Fix 1 (Serious) — agent-catalog.md: Add DESIGN to nitro-project-manager Triggers
File: `.claude/skills/orchestration/references/agent-catalog.md`
In the `nitro-project-manager` section under `**Triggers**`, add:
```
- DESIGN tasks (Phase 1 — requirements gathering)
```

### Fix 2 (Serious) — SKILL.md: Make Phase Detection Strategy-Aware for DESIGN
File: `.claude/skills/orchestration/SKILL.md`
In the CONTINUATION Phase Detection table, add a note or conditional row:
```
| task-description.md (task type = DESIGN) | Skip architect — invoke nitro-ui-ux-designer |
```
This can be implemented as a starred footnote or inline condition in the existing row.

### Fix 3 (Serious) — checkpoints.md + strategies.md: Restrict QA Options for DESIGN Tasks
File: `.claude/skills/orchestration/references/checkpoints.md` and `.claude/skills/orchestration/references/strategies.md`
In the DESIGN Review Criteria table, add a note:
```
Note: For DESIGN tasks, valid QA options at Checkpoint 3 are `style` or `skip` only.
nitro-code-logic-reviewer and nitro-senior-tester are not applicable to design document artifacts.
```

### Fix 4 (Moderate) — SKILL.md: Update Front-Matter Description to Include DESIGN
File: `.claude/skills/orchestration/SKILL.md`
Change description field to include "(8) UI/UX design, wireframes, design systems, brand identity (DESIGN flow)".

### Fix 5 (Moderate) — strategies.md: Remove "brand identity" from CREATIVE "When to use"
File: `.claude/skills/orchestration/references/strategies.md`
In the CREATIVE section "When to use" description (line ~338), remove "brand identity" from the list, since brand identity work routes to DESIGN when no code output is implied. Add a note: "Brand identity without code output → DESIGN strategy."

---

## What Robust Implementation Would Include

- Strategy-aware phase detection: each strategy defines its own phase-to-next-action mapping, preventing the DESIGN-resumes-as-FEATURE footgun
- Per-strategy QA option restriction: the QA choice checkpoint renders only the valid options for the current task type
- Cross-document keyword ownership: each keyword appears in exactly one strategy's trigger list; the disambiguation table is the authority for overlap cases, not the "When to use" prose
- A DESIGN example trace (design-trace.md) showing a realistic design task run from start to finish, matching the existing feature-trace.md and bugfix-trace.md artifacts
