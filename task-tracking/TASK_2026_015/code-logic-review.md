# Code Logic Review - TASK_2026_015

## Review Summary

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Overall Score       | 6.5/10                               |
| Assessment          | NEEDS_REVISION                       |
| Critical Issues     | 1                                    |
| Serious Issues      | 3                                    |
| Moderate Issues     | 3                                    |
| Failure Modes Found | 5                                    |

## The 5 Paranoid Questions

### 1. How does this fail silently?

The Stack-to-Agent Mapping table has gaps. If the `/create-agent` command detects `nuxt`, `svelte`, `fastify`, `quarkus`, `micronaut`, `tensorflow`, `sinatra`, `xamarin`, `maui`, or plain `kotlin`/`ruby`/`csharp`/`php`/`dart` without a framework, the mapping lookup silently produces no result. There is no fallback rule or explicit "unmapped" error. The consuming command would either crash or silently skip agent generation for a detected stack.

### 2. What user action causes unexpected behavior?

A user runs `/create-agent` on a Nuxt.js project. The registry detects `nodejs` + `nuxt` correctly. But the Stack-to-Agent Mapping has no entry for `nuxt`. The command either generates nothing (silent failure) or falls back to `nodejs` without framework, producing a generic TypeScript developer agent for what should be a Nuxt-specific one.

### 3. What data makes this produce wrong results?

A `build.gradle.kts` file is detected, mapping to `kotlin` stack ID. But the Stack-to-Agent Mapping only has `kotlin` + `android`. A Kotlin backend project (e.g., Ktor, Spring Boot with Kotlin) would either get no agent or fall through to `java` + `spring-boot` if the build file also references Spring -- but the detection rule maps `.gradle.kts` to `kotlin`, not `java`, so the Spring mapping (`java` + `spring-boot`) would not match either.

### 4. What happens when dependencies fail?

These are static reference files consumed by other commands, so traditional runtime dependency failures do not apply. However, the "dependency" here is the consuming command's parser. If the `/create-agent` command (TASK_2026_016) parses these tables, any structural inconsistency (e.g., the `swift / swift-ios` combined entry in the mapping table) could confuse a naive parser that expects exact stack ID matches.

### 5. What's missing that the requirements didn't mention?

1. **Fallback/default agent mapping**: What happens when a stack is detected but has no specific mapping? There is no documented fallback behavior.
2. **Priority/precedence rules**: When multiple stacks are detected (e.g., both `nodejs` and `typescript`), which mapping wins? The rules say "framework-specific over language-level" but don't address conflicts between two framework detections.
3. **Template quality checklist is incomplete**: The backend-developer.md has 6 quality checklist items in the return format; the template hardcodes only 3 generic ones and loses language-specific items (type safety, error handling, DI, build verification).
4. **Escalation protocol detail lost**: The template's escalation section is significantly abbreviated compared to the reference agent, losing the structured escalation document format.

---

## Failure Mode Analysis

### Failure Mode 1: Unmapped Stack Detection

- **Trigger**: Detection of any framework without a corresponding Stack-to-Agent Mapping entry (nuxt, svelte, fastify, quarkus, micronaut, tensorflow, sinatra, xamarin, maui, tauri on Node side)
- **Symptoms**: No agent generated for a detected stack, or wrong fallback agent generated
- **Impact**: Serious -- user gets incomplete or wrong agent setup for their project
- **Current Handling**: None. The mapping table simply lacks these entries. No fallback rule is documented.
- **Recommendation**: Either (a) add all detected frameworks to the mapping table, or (b) add an explicit "Unmapped Stacks" section documenting fallback behavior (e.g., fall back to language-level agent).

### Failure Mode 2: Kotlin Backend Has No Agent Path

- **Trigger**: `build.gradle.kts` detected in a non-Android Kotlin project (e.g., Ktor, Spring Boot with Kotlin DSL)
- **Symptoms**: Stack ID is `kotlin` but no framework match exists unless `android` plugin is also detected. No `kotlin` (no framework) row in mapping.
- **Impact**: Serious -- Kotlin server-side projects get no developer agent
- **Current Handling**: None
- **Recommendation**: Add `kotlin (no framework)` -> `kotlin-developer` mapping, and add `kotlin` + `spring-boot` mapping (since Kotlin + Spring Boot is extremely common).

### Failure Mode 3: Template Produces Incomplete Agent (Lost Sections)

- **Trigger**: Populating the template with variables and comparing to backend-developer.md quality bar
- **Symptoms**: Generated agent is missing detailed escalation document format, missing 3 of 6 quality checklist items in return format, missing 2 of 5 anti-backward-compatibility rules
- **Impact**: Moderate -- generated agents are subtly weaker than hand-crafted ones, defeating the purpose of the template
- **Current Handling**: Content is simply absent from template
- **Recommendation**: Restore the full escalation markdown format as hardcoded template content, parameterize or restore the quality checklist items, restore the 2 missing anti-backward-compatibility bullets.

### Failure Mode 4: Ambiguous Stack ID in Mapping Table

- **Trigger**: The mapping row `swift / swift-ios` (line 196 of registry) uses a slash to combine two stack IDs
- **Symptoms**: A parser expecting exact stack ID match would fail to match either `swift` or `swift-ios` against the string `swift / swift-ios`
- **Impact**: Moderate -- depends on how the consuming command parses the table
- **Current Handling**: Human-readable but machine-ambiguous
- **Recommendation**: Split into two rows: `swift` -> `ios-developer` and `swift-ios` -> `ios-developer`

### Failure Mode 5: No Disambiguation for Overlapping Detections

- **Trigger**: A project has both `package.json` (nodejs) and `tsconfig.json` (typescript). Both are detected. The mapping has separate entries for `nodejs` + framework and `typescript (no framework)`.
- **Symptoms**: Unclear whether both agents are generated, or which takes priority
- **Impact**: Moderate -- could result in duplicate or conflicting agents
- **Current Handling**: The "Mapping Rules" section says framework-specific wins over language-level, but does not address the nodejs/typescript overlap specifically
- **Recommendation**: Add a note that `typescript` is a modifier of `nodejs`, not a separate stack, and should not independently trigger the `typescript (no framework)` mapping when a Node.js framework is also detected.

---

## Critical Issues

### Issue 1: 13 Detected Frameworks/Stacks Have No Agent Mapping

- **File**: `.claude/skills/orchestration/references/stack-detection-registry.md:176-203`
- **Scenario**: Any of these frameworks are detected in a real project
- **Impact**: The entire purpose of the registry is to map detection to agent generation. Gaps here mean the system fails at its core job for these stacks.
- **Evidence**: Frameworks detected but unmapped:
  - `nuxt` (line 52) -- no mapping
  - `svelte` (line 53) -- no mapping
  - `fastify` (line 55) -- no mapping
  - `tauri` on Node side (line 58) -- no mapping
  - `quarkus` (line 75) -- no mapping
  - `micronaut` (line 76) -- no mapping
  - `tensorflow` (line 68) -- no mapping (pytorch maps to ml-developer but tensorflow does not)
  - `sinatra` (line 90) -- no mapping
  - `xamarin` (line 97) -- no mapping
  - `maui` (line 98) -- no mapping
  - `kotlin` no framework -- no mapping
  - `ruby` no framework -- no mapping
  - `csharp` no framework -- no mapping
  - `php` no framework -- no mapping
  - `dart` no framework -- no mapping
- **Fix**: Add mapping rows for every detected framework/stack combination. At minimum:
  - `nodejs` + `nuxt` -> `nuxt-developer`
  - `nodejs` + `svelte` -> `svelte-developer`
  - `nodejs` + `fastify` -> `fastify-developer` (or `express-developer` if grouping)
  - `nodejs` + `tauri` -> `tauri-developer`
  - `java` + `quarkus` -> `quarkus-developer`
  - `java` + `micronaut` -> `micronaut-developer`
  - `python` + `tensorflow` -> `ml-developer` (same as pytorch)
  - `ruby` + `sinatra` -> `sinatra-developer` (or `ruby-developer`)
  - `ruby` (no framework) -> `ruby-developer`
  - `kotlin` (no framework) -> `kotlin-developer`
  - `csharp` + `xamarin` -> `dotnet-developer` or `mobile-developer`
  - `csharp` + `maui` -> `dotnet-developer` or `mobile-developer`
  - `csharp` (no framework) -> `dotnet-developer`
  - `php` (no framework) -> `php-developer`
  - `dart` (no framework) -> `dart-developer`

---

## Serious Issues

### Issue 1: Template Escalation Protocol Loses Structured Document Format

- **File**: `.claude/skills/orchestration/references/developer-template.md:109-137`
- **Scenario**: A generated agent needs to escalate a blocking issue
- **Impact**: Developer agents generated from this template will not include the detailed escalation document format (Task, File, Issue, Technical Details, Options, Recommendation, Blocked Until), which the backend-developer.md provides at lines 251-274. Escalations from generated agents will be less structured.
- **Evidence**: The template has a prose list of "What You MUST Do When Triggered" (lines 127-129) with 3 generic steps, while backend-developer.md has a full markdown template with 7 fields inside a code block.
- **Fix**: Add the structured escalation markdown block as hardcoded content in the template (it is not stack-specific, so it should not be a variable).

### Issue 2: Return Format Quality Checklist Missing Language-Specific Items

- **File**: `.claude/skills/orchestration/references/developer-template.md:223-226`
- **Scenario**: Generated agent completes a task and produces a completion report
- **Impact**: The quality checklist in the return format only has 3 items; backend-developer.md has 6 (adding type safety, error handling + DI, and build verification). Generated agents will produce less thorough completion reports.
- **Evidence**: Template lines 224-226 vs backend-developer.md lines 564-569
- **Fix**: Either add a `{quality_checklist_content}` variable, or include the additional items as hardcoded generic text (e.g., "All types strictly defined" is universal enough).

### Issue 3: Anti-Backward Compatibility Section Missing 2 Rules

- **File**: `.claude/skills/orchestration/references/developer-template.md:188-193`
- **Scenario**: Generated agent encounters a situation requiring version management
- **Impact**: The template hardcodes only 3 anti-backward-compatibility rules, but backend-developer.md has 5. Missing: "NEVER implement service classes with version suffixes" and "NEVER maintain database schemas with old + new versions".
- **Fix**: Add the 2 missing bullet points. These are not stack-specific.

---

## Moderate Issues

### Issue 1: `swift / swift-ios` Combined Entry in Mapping Table

- **File**: `.claude/skills/orchestration/references/stack-detection-registry.md:196`
- **Impact**: Machine-parsing ambiguity. A slash-separated combined entry may not match either `swift` or `swift-ios` stack IDs during lookup.
- **Fix**: Split into two separate rows.

### Issue 2: No Documented Conflict Resolution for Multiple Framework Detection

- **File**: `.claude/skills/orchestration/references/stack-detection-registry.md:205-209`
- **Impact**: A project with both `react` and `next` in package.json would match both frameworks. The mapping rules don't specify that Next.js subsumes React.
- **Fix**: Add a "Conflict Resolution" subsection with rules like: "When both a meta-framework (Next.js, Nuxt) and its base framework (React, Vue) are detected, prefer the meta-framework mapping."

### Issue 3: Template Step 5 Missing Code Block Formatting

- **File**: `.claude/skills/orchestration/references/developer-template.md:95-97`
- **Scenario**: Generated agent reads Step 5 (Verify Imports & Patterns)
- **Impact**: Backend-developer.md uses code blocks with bash comments for Steps 1-5 making them visually scannable. The template Step 5 is plain text without code blocks. The generated agent's readability will be inconsistent.
- **Fix**: Use the same code-block-with-comments format as the reference agent.

---

## Data Flow Analysis

```
Project Files on Disk
       |
       v
[Stack Detection Registry] -- scanned by /create-agent command
       |
       | Detects: language stack IDs + framework IDs
       v
[Stack-to-Agent Mapping Table] -- lookup by stack combo
       |                               |
       | FOUND                         | NOT FOUND  <-- GAP: 13+ combos unmapped
       v                               v
[Developer Template]            ??? (no fallback defined)
       |
       | Variables populated with stack-specific content
       v
[Generated Agent .md File]
       |
       | Missing: escalation format, quality checklist items,
       | 2 anti-backward rules
       v
[Agent used by developer workers]
```

### Gap Points Identified:

1. Detection-to-mapping gap: 13+ framework/stack combos detected but unmapped
2. Template-to-reference gap: 3 sections have content loss vs backend-developer.md
3. No fallback behavior documented for unmapped stacks

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Registry exists at correct path | COMPLETE | None |
| Registry covers all 10 ecosystems | COMPLETE | All 10 present in Language Detection Rules |
| Every rule has confidence level | COMPLETE | Verified across all 5 tables |
| Content patterns for disambiguation | COMPLETE | All framework rules have content patterns |
| Monorepo indicators (6 required) | COMPLETE | Has 9 (exceeds requirement) |
| Stack-to-Agent Mapping included | PARTIAL | Table exists but has 13+ gaps vs detected stacks |
| Template exists at correct path | COMPLETE | None |
| Template has all 14 sections | COMPLETE | All 14 verified in correct order |
| All template variables documented | COMPLETE | 16 variables, all in reference table and template body |
| Template under 300 lines | COMPLETE | 247 lines (including markdown fence) |
| Registry under 300 lines | COMPLETE | 210 lines |

### Implicit Requirements NOT Addressed:

1. **Fallback behavior for unmapped stacks** -- what should the consuming command do when detection succeeds but mapping fails?
2. **Conflict resolution for overlapping detections** -- how to handle React+Next, Vue+Nuxt, etc.
3. **Parity between template output and reference agent quality** -- the template loses non-trivial content compared to backend-developer.md

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Monorepo with multiple stacks | YES | Mapping Rules note: "may produce multiple agents" | No ordering/priority guidance |
| Framework detected without language | NO | N/A | Theoretically impossible given detection order, but not stated |
| Two frameworks from same language | PARTIAL | "framework-specific wins over language-level" | Does not address two frameworks at same level (React + Next) |
| `build.gradle` vs `build.gradle.kts` | YES | Separate rules, separate stack IDs | Kotlin backend has no mapping though |
| Infrastructure/DB detection | YES | "Inform agent content, do not generate agents" | Clear |
| Empty/malformed manifest file | NO | Content patterns assume file has expected structure | If package.json exists but is empty, detection may false-positive |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Registry -> /create-agent parser | MEDIUM | Agent generation fails or produces wrong agent | Need: exact format contract between files |
| Template -> /create-agent populator | LOW | Variables not fully replaced | Template variable table is thorough |
| Mapping gaps -> user experience | HIGH | Detected stack gets no agent | Need: complete mapping or fallback |
| Template -> generated agent quality | MEDIUM | Agent weaker than hand-crafted ones | Need: restore lost content from reference |

---

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Top Risk**: 13+ detected framework/stack combinations have no entry in the Stack-to-Agent Mapping table, meaning the core purpose of the registry (detection -> agent generation) has systematic gaps.

## What Robust Implementation Would Include

1. **Complete mapping coverage**: Every detectable framework/stack combo maps to an agent name, with no gaps. If certain stacks intentionally share an agent, document that explicitly.
2. **Fallback rules**: "If no framework-specific mapping exists, fall back to language-level agent. If no language-level mapping exists, generate a generic developer agent."
3. **Conflict resolution table**: When two frameworks overlap (React+Next, Vue+Nuxt, etc.), document which takes precedence.
4. **Template content parity**: The template should produce agents that are structurally AND content-equivalent to the hand-crafted reference. Currently 3 sections lose non-trivial content.
5. **Split ambiguous mapping entries**: `swift / swift-ios` should be two rows.
6. **Error case documentation**: What happens when a manifest file exists but is malformed? What if detection produces an empty stack list?
