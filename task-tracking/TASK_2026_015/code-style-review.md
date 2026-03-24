# Code Style Review - TASK_2026_015

## Review Summary

| Metric          | Value          |
|-----------------|----------------|
| Overall Score   | 6/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 2              |
| Serious Issues  | 5              |
| Minor Issues    | 6              |
| Files Reviewed  | 2              |

## The 5 Critical Questions

### 1. What could break in 6 months?

The template claims to produce output "structurally identical to backend-developer.md" but it structurally cannot. The backend-developer has bash code fences around initialization steps, an ESCALATION REQUIRED markdown block inside the escalation protocol, an OPTION A: BATCH EXECUTION subsection with a full TypeScript code example, and a KEY PRINCIPLE callout -- none of which exist in the template. When `/create-agent` (TASK_2026_016) tries to use this template, the generated agent will be noticeably stripped-down compared to the hand-crafted backend-developer.md. This will surface as a quality gap the moment anyone compares generated vs existing agents.

In the registry, `build.gradle.kts` is mapped to Stack ID `kotlin` (line 29) with confidence "high". This is wrong -- Kotlin DSL is a build script language choice, not an indicator the project itself is Kotlin. A Java project using Kotlin DSL for Gradle will be misdetected as Kotlin. This will produce incorrect agent recommendations in 6 months when the CLI init flow consumes this registry.

### 2. What would confuse a new team member?

The task acceptance criteria say "all 14 sections matching backend-developer.md structure" but the actual backend-developer.md has 12 top-level `##` sections (IMPORTANT, CORE PRINCIPLES, MANDATORY INIT, MANDATORY ESCALATION, GIT OPS, PATTERN AWARENESS, CODE QUALITY, UNIVERSAL RULES, ANTI-PATTERNS, PRO TIPS, RETURN FORMAT, CORE INTELLIGENCE). Neither the task nor the template explains where the number 14 comes from. A new team member counting sections will get confused.

The template variable reference table says `{return_fields}` example is `**Service/Feature**: [What was implemented]` but the template body at line 215 places `{return_fields}` on its own line with no surrounding structure. The backend-developer.md has `**Service/Feature**:` as a separate line between `**User Request Implemented**:` and `**Complexity Level**:`. It is unclear whether `{return_fields}` is supposed to include the field label and value placeholder, or just the field name. This ambiguity will cause inconsistent agent generation.

### 3. What's the hidden complexity cost?

The template cannot produce the frontend-developer.md structure. The frontend agent has 3 extra initialization steps (Step 3: Read UI/UX Design Documents, Step 5.6: Design Fidelity Verification, Design Document Priority Order) and a differently-named quality section ("COMPONENT QUALITY STANDARDS" vs "CODE QUALITY STANDARDS"). The systems-developer.md has a unique "DOMAIN EXPERTISE" section and omits "PRO TIPS". The template has no mechanism (optional sections, conditional blocks, slot variables) to handle these structural variations. Either every generated agent will be forced into the backend-developer shape, or the template will need significant rework to support role variants. This is an architectural gap that will compound as more agent types are needed.

### 4. What pattern inconsistencies exist?

**Registry table column inconsistency**: The Language Detection table has columns `Manifest File | Stack ID | Category | Confidence | Content Patterns`. The Framework Detection tables have columns `Dependency / Pattern | Framework ID | Confidence | Content Pattern` (singular "Pattern" vs plural "Patterns"). The Infrastructure table has `File Pattern | Infrastructure ID | Category | Confidence` (no Content Pattern column at all). The Database table has `Config Pattern | Database ID | Confidence | Content Pattern`. Four different column naming conventions across five table types in one file.

**Template vs backend-developer RETURN FORMAT**: The backend-developer wraps the return format in a code fence (` ```markdown ... ``` `) making it clear the content is a template the agent should fill in. The template (line 210-234) does NOT wrap the return format in a code fence -- it renders the return format as live markdown. This means the generated agent will have its return format rendered as actual headings instead of being shown as a template block.

### 5. What would I do differently?

1. **Fix the return format wrapping** -- add code fences around the return format block in the template, matching backend-developer.md exactly.
2. **Add optional section variables** -- introduce `{optional_init_steps}`, `{optional_post_init_steps}` variables for role-specific initialization (design docs for frontend, domain expertise for systems).
3. **Normalize table columns** -- pick one naming convention across all registry tables (e.g., always "Detection Pattern", always "ID", always "Confidence", always "Content Pattern").
4. **Fix the `build.gradle.kts` detection** -- map it to `java` with a content pattern check for `kotlin("jvm")` plugin to distinguish.
5. **Count sections explicitly** -- add a comment or reference that defines what the "14 sections" are, or correct the number to match reality.

---

## Blocking Issues

### Issue 1: Template RETURN FORMAT not wrapped in code fence

- **File**: `.claude/skills/orchestration/references/developer-template.md:208-234`
- **Problem**: The RETURN FORMAT section in backend-developer.md (lines 545-580) wraps the entire completion report in a markdown code fence (` ```markdown ... ``` `). The template renders lines 210-234 as live markdown -- the `## {return_header} - TASK_[ID]` at line 212 becomes an actual heading in the generated agent file instead of a template the agent should fill in.
- **Impact**: Every generated agent will have a broken return format section. The agent will see rendered headings instead of a template block to copy. This makes the generated output structurally non-identical to backend-developer.md, violating the core acceptance criterion.
- **Fix**: Wrap lines 210-234 in ` ```markdown ... ``` ` fences, exactly as backend-developer.md does it. The `### Task Completion Report` header should remain outside the fence; the report content goes inside.

### Issue 2: `build.gradle.kts` incorrectly mapped to `kotlin` with high confidence

- **File**: `.claude/skills/orchestration/references/stack-detection-registry.md:29`
- **Problem**: `build.gradle.kts` is the Kotlin DSL variant of Gradle build files. It does NOT mean the project uses Kotlin as its application language. Java projects commonly use Kotlin DSL for build scripts. The current mapping `build.gradle.kts -> kotlin (high confidence)` will cause Java-with-Kotlin-DSL projects to be detected as Kotlin and get the wrong developer agent.
- **Impact**: Incorrect stack detection leads to wrong agent generation. A Spring Boot Java project using `build.gradle.kts` would get a Kotlin agent instead of a Java/Spring agent.
- **Fix**: Map `build.gradle.kts` to `java` with confidence `medium`. Add a content pattern: "Check for `kotlin("jvm")` or `org.jetbrains.kotlin` plugin to confirm Kotlin; otherwise treat as Java with Kotlin DSL build." Add a separate entry: `src/main/kotlin/` directory presence -> `kotlin` (high).

---

## Serious Issues

### Issue 1: Template cannot reproduce frontend-developer or systems-developer structure

- **File**: `.claude/skills/orchestration/references/developer-template.md` (entire file)
- **Problem**: The template is structurally locked to the backend-developer pattern. The frontend-developer has Step 3 (UI/UX docs), Step 5.6 (Design Fidelity), and "COMPONENT QUALITY STANDARDS" instead of "CODE QUALITY STANDARDS". The systems-developer has "DOMAIN EXPERTISE" and omits "PRO TIPS". No variable or conditional mechanism exists to handle these variations.
- **Tradeoff**: Adding conditional sections increases template complexity but is necessary for a "single source-of-truth template that generates any developer agent" as the file header claims.
- **Recommendation**: Add variables for optional sections: `{additional_init_steps}` (empty for backend, design doc steps for frontend), `{additional_sections}` (empty for backend, DOMAIN EXPERTISE for systems), and `{quality_section_title}` (defaults to "CODE QUALITY STANDARDS", overridden to "COMPONENT QUALITY STANDARDS" for frontend).

### Issue 2: Table column naming inconsistency across registry sections

- **File**: `.claude/skills/orchestration/references/stack-detection-registry.md` (lines 19, 46, 126, 146, 162)
- **Problem**: Five table types use four different column naming conventions:
  - Language: `Content Patterns` (plural)
  - Framework: `Content Pattern` (singular)
  - Infrastructure: no content pattern column
  - Database: `Content Pattern` (singular)
  - Monorepo: `Scan Strategy` (different concept entirely)
- **Tradeoff**: Minor for human readers but a consistency smell. If any tooling parses these tables programmatically, the inconsistent column names will cause bugs.
- **Recommendation**: Standardize to `Content Pattern` (singular) across Language, Framework, and Database tables. Add a `Content Pattern` column to Infrastructure (even if most entries are "N/A" -- the column existence signals completeness). Keep `Scan Strategy` for Monorepo as it serves a different purpose.

### Issue 3: "14 sections" claim is unverifiable

- **File**: `task-tracking/TASK_2026_015/task.md:36` and `.claude/skills/orchestration/references/developer-template.md:32`
- **Problem**: The acceptance criteria state "Template contains all 14 sections matching backend-developer.md structure." The backend-developer.md has 12 top-level `##` sections. Even counting the frontmatter block and the `# Title` as sections only gets to 14 by stretching definitions. The template file itself says "all 14 sections below in this exact order" (line 32) but does not enumerate what those 14 are.
- **Tradeoff**: If this is a counting methodology difference, it should be documented. If it is an error, it erodes trust in the spec.
- **Recommendation**: Add a numbered list of the 14 sections (or correct to 12) either in the template instructions or as a comment. Example: "The 12 mandatory sections are: 1. IMPORTANT, 2. CORE PRINCIPLES, 3. MANDATORY INIT, ..."

### Issue 4: Missing OPTION A: BATCH EXECUTION subsection in template

- **File**: `.claude/skills/orchestration/references/developer-template.md:140-165`
- **Problem**: The backend-developer.md (lines 300-370) has a detailed "OPTION A: BATCH EXECUTION" subsection under STEP 6 with a full TypeScript code example demonstrating batch implementation, followed by a batch execution workflow and a responsibility table. The template (lines 140-165) has a compressed version that combines git operations, batch workflow, and the responsibility table but omits the code example entirely and does not have the OPTION A header structure.
- **Tradeoff**: Code examples are stack-specific, so omitting them is understandable, but there should be a `{batch_example}` variable or explicit instruction that the populator must include one.
- **Recommendation**: Either add a `{batch_code_example}` variable in the Step 6 section, or add a line in the template instructions stating "The populator must include a stack-idiomatic batch execution code example."

### Issue 5: Missing Stack-to-Agent mappings for several detected stacks

- **File**: `.claude/skills/orchestration/references/stack-detection-registry.md:176-203`
- **Problem**: The Framework Detection section defines `svelte`, `nuxt`, `fastify`, `tauri`, `quarkus`, `micronaut`, `sinatra`, `xamarin`, `maui`, `fiber` framework IDs, but the Stack-to-Agent Mapping table has no entries for any of them. A detection engine that finds Svelte, Nuxt, Fastify, Tauri, Quarkus, Micronaut, Sinatra, Xamarin, MAUI, or Fiber will have no agent mapping to follow.
- **Tradeoff**: The mapping table cannot cover every framework, but omitting 10 detected frameworks creates a gap between "what we detect" and "what we can act on."
- **Recommendation**: Either add mapping entries for all detected frameworks (even if some map to a generic language-level agent as fallback), or add an explicit fallback rule: "If a framework ID has no mapping entry, fall back to the language-level agent."

---

## Minor Issues

1. **`.claude/skills/orchestration/references/developer-template.md:32`** -- States "Generated agent must have all 14 sections below in this exact order and must be under 400 lines" but the acceptance criteria in task.md say "Template is under 300 lines." The 400-line limit in the template refers to generated output, not the template itself. This is confusing -- the two different limits (300 for template file, 400 for generated output) should be more clearly distinguished.

2. **`.claude/skills/orchestration/references/stack-detection-registry.md:31`** -- `*.xcodeproj` uses a glob pattern while all other entries use exact filenames. The `*.csproj` and `*.sln` entries (lines 36-37) also use globs. This is fine semantically but the inconsistency between glob entries and exact entries is not called out in the "How to Use" section, which says "scan for manifest files listed."

3. **`.claude/skills/orchestration/references/stack-detection-registry.md:153`** -- `mongod.conf / mongoose in deps` mixes two completely different detection strategies (config file vs dependency) in one row. These should be separate rows with different confidence levels.

4. **`.claude/skills/orchestration/references/stack-detection-registry.md:154`** -- Same issue: `redis.conf / ioredis in deps` mixes config file detection with dependency detection in one row.

5. **`.claude/skills/orchestration/references/developer-template.md:66`** -- `Glob(task-tracking/TASK_[ID]/**.md)` is not wrapped in a code fence, unlike the same line in backend-developer.md (line 93) which is inside a `bash` code fence. Generated agents will display the Glob call as plain text instead of in a code block.

6. **`.claude/skills/orchestration/references/stack-detection-registry.md:196`** -- `swift / swift-ios` uses a slash separator while all other entries use `+` (e.g., `nodejs + react`). Should be consistent.

---

## File-by-File Analysis

### stack-detection-registry.md

**Score**: 7/10
**Issues Found**: 1 blocking, 2 serious, 4 minor

**Analysis**:
The registry is well-organized, covers the required 10 ecosystems, includes monorepo indicators, and stays within the 300-line limit at 210 lines. The "How to Use This File" section is a strong addition that gives clear procedural guidance. Confidence levels are present on every detection rule. The Stack-to-Agent Mapping table is useful.

**Specific Concerns**:
1. `build.gradle.kts -> kotlin` mapping is factually incorrect (line 29) -- BLOCKING
2. 10 framework IDs have no agent mapping (lines 176-203 vs Framework Detection) -- SERIOUS
3. Table column names are inconsistent across sections -- SERIOUS
4. Database detection rows mix two strategies per row (lines 153-154) -- MINOR
5. `swift / swift-ios` separator inconsistency (line 196) -- MINOR

### developer-template.md

**Score**: 5/10
**Issues Found**: 1 blocking, 3 serious, 2 minor

**Analysis**:
The template captures the general structure and most variables are well-documented in the reference table. The variable naming is clear and the instructions for the populator are helpful. However, the template has significant structural gaps compared to backend-developer.md that violate the "structurally identical" requirement. The missing code fence around the return format is a breaking issue. The template also cannot handle frontend-developer or systems-developer structural variations, limiting its claim as a "single source-of-truth template."

**Specific Concerns**:
1. Return format not wrapped in code fence -- BLOCKING (line 208-234)
2. Cannot produce frontend/systems agent structures -- SERIOUS (entire file)
3. Missing batch execution code example variable -- SERIOUS (line 140-165)
4. "14 sections" claim unverifiable -- SERIOUS (line 32)
5. Glob call not in code fence unlike backend-developer.md -- MINOR (line 66)
6. 400-line vs 300-line limit confusion -- MINOR (line 32)

---

## Pattern Compliance

| Pattern                          | Status | Concern                                                                                     |
|----------------------------------|--------|---------------------------------------------------------------------------------------------|
| Markdown formatting              | PASS   | Generally clean, consistent heading hierarchy                                               |
| Table formatting                 | FAIL   | Column naming inconsistency across registry tables                                          |
| Naming consistency (IDs)         | FAIL   | `build.gradle.kts` mismapped; `swift / swift-ios` separator differs from `+` convention     |
| Structural fidelity to reference | FAIL   | Template output will not be structurally identical to backend-developer.md                   |
| Documentation clarity            | PASS   | "How to Use" section and variable reference table are clear                                 |
| File size compliance             | PASS   | Registry: 210 lines (<300), Template: 247 lines (<300)                                      |
| Single source of truth           | FAIL   | Template claims to be single source but cannot produce all 3 existing agent variants         |

## Technical Debt Assessment

**Introduced**:
- Template structural rigidity will require rework when generating non-backend agents
- 10 unmapped framework IDs create a detection-without-action gap
- `build.gradle.kts` mismap will propagate incorrect detections until fixed

**Mitigated**:
- Having a registry at all is better than ad-hoc detection
- Variable reference table reduces ambiguity for template consumers
- Explicit confidence levels prevent overconfident stack detection

**Net Impact**: Net positive for the project, but the debt introduced needs to be addressed before TASK_2026_016 (the consumer) is implemented, or it will inherit these issues.

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Key Concern**: The template's RETURN FORMAT section is not wrapped in a code fence, making every generated agent structurally broken in that section. Combined with the `build.gradle.kts` mismap, these two blocking issues must be fixed. The serious issues (template rigidity, unmapped frameworks, column inconsistency) should be addressed before TASK_2026_016 consumes these files.

## What Excellence Would Look Like

A 10/10 implementation would include:

1. **Template structural parity** -- every structural element in backend-developer.md (code fences, subsection headers, code examples) has a corresponding element or variable in the template. A diff between "template with backend variables filled in" and "actual backend-developer.md" would show zero structural differences.
2. **Role-variant support** -- optional section variables that allow the template to produce frontend-developer and systems-developer structures, not just backend. Each variant's unique sections would be documented with example content.
3. **Registry self-consistency** -- identical column structure across all detection tables, with a clear note explaining any intentional deviations.
4. **Complete agent mapping** -- every detected framework ID maps to an agent, even if it is a fallback to the language-level agent. An explicit "Fallback Rules" section for unmapped combinations.
5. **Verification instructions** -- a "How to Verify" section in the template that says "After populating, diff the output against backend-developer.md. The only differences should be in content, not structure."
6. **Enumerated section list** -- an explicit numbered list of the N sections, so the "all N sections" claim is verifiable without manual counting.
