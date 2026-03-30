# Style Review — TASK_2026_129

## Score: 7/10

## Findings

- **Ambiguous "token" definition.** The new prose uses the word "token" without defining
  what it means in argument-parsing context. Surrounding bullet items in Step 2 use the
  pattern "if followed by a `SESSION_{...}` token" (old text) or just "a token" (new text).
  An LLM reading the instruction cold has to infer that "token" means "the next
  whitespace-delimited word after `--continue` in `$ARGUMENTS`". This inference is
  reasonable but not guaranteed — add one phrase like "the next whitespace-separated
  argument" to anchor it.

- **Regex format string in backtick-code-span inside a block-quote bullet — brittle rendering.**
  The regex `^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$` is inlined in prose as
  a code span. Markdown renderers (and some LLM context windows) may interpret the curly
  braces as template interpolation, stripping or mangling `\d{4}` into `\d` followed by
  a raw `{4}`. The other bullet items in Step 2 avoid regex entirely. If this bites,
  validation silently accepts any string. Consider spelling out the constraint in plain
  English alongside the regex, or wrapping it in a fenced code block so rendering is
  unambiguous.

- **"If the token does NOT match" is under-specified for the absent-then-present case.**
  The paragraph reads: "if followed by a token, validate…; if the token does NOT match,
  STOP." It then says: "If the token matches or no token is provided, use the validated
  SESSION_ID… or auto-detect." The branching is correct, but there is a subtle gap: if
  `--continue` is the LAST argument (no token follows), or if the next word starts with
  `--` (e.g., `--continue --dry-run`), an LLM must decide whether `--dry-run` is the
  token to validate. The old text had the same gap, but the new change adds a hard STOP
  on mismatch, making this ambiguity more dangerous — an LLM might validate `--dry-run`
  against the regex, fail, and halt instead of entering continue+dry-run mode. A single
  clarifying clause ("a token is any argument that does not begin with `--`") closes this.

- **EXIT instruction is not consistently formatted with the rest of the file.**
  `**STOP IMMEDIATELY**` and `**EXIT. Do not continue to Step 4.**` are the patterns used
  everywhere else in the file (Steps 3c, 4h). The new text uses `**STOP IMMEDIATELY**`
  (matches), but closes with `and EXIT.` in lowercase body text, not as a bold directive.
  This inconsistency could cause an LLM to treat "EXIT" as a description rather than a
  hard instruction. Change to `**EXIT.**` to match the pattern in Step 3c.

- **Error message string is double-quoted in prose but uses straight quotes in the inline
  code span.** The line reads:
  `"ERROR: Invalid SESSION_ID format…"` and EXIT.
  The outer double-quote belongs to the surrounding prose; the inner content is a code
  span. This is fine stylistically, but the pattern used elsewhere in the file (Step 3c's
  FATAL message) omits the surrounding prose quotes and just shows the code span. Minor
  inconsistency, but worth aligning so LLMs copy the pattern uniformly.

- **"Refusing to proceed to prevent path traversal" is the right rationale but may be
  surprising to a developer reading the Usage examples.** The `--continue` usage line in
  the Parameters table says only `flag or SESSION_ID string`, with no hint that an invalid
  string hard-stops the command. The Parameters table description should add a parenthetical
  such as "(invalid format exits immediately)" so a user who typos a session ID understands
  why the command refuses rather than auto-detecting.

- **Scope of the "valid (or absent)" parenthetical is easy to misread.**
  "If `--continue` is present and the SESSION_ID is valid (or absent)" — "absent" is
  ambiguous: absent means the SESSION_ID was not supplied, not that `--continue` itself
  is absent. A pedantic LLM could interpret "SESSION_ID is absent" as a case where
  `--continue` is also absent, creating a false skip of Steps 3 and 4. Rephrase to
  "the SESSION_ID is valid, or no SESSION_ID was provided" to be explicit.

- **Both files are confirmed identical.** The scaffold copy at
  `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md` and the live copy at
  `.claude/commands/nitro-auto-pilot.md` contain the same text for the changed block.
  No sync drift.

## Required Fixes

- **Fix 1 (blocking for LLM correctness):** Add a clause specifying that a "token" is
  the next whitespace-separated argument that does not begin with `--`. Without this,
  `--continue --dry-run` may cause a hard STOP instead of entering continue+dry-run mode.
  Apply to both files at line 64 in `.claude/commands/nitro-auto-pilot.md` and the
  corresponding line in `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md`.

- **Fix 2 (serious — consistency):** Change `and EXIT.` at the end of the STOP sentence
  to `**EXIT.**` to match the bold-directive pattern used in Steps 3c and 4h.

- **Fix 3 (minor):** Add "(invalid format exits immediately)" to the `--continue` row in
  the Parameters table so the error behavior is discoverable without reading Step 2 prose.

## Approved

no — Fix 1 must be resolved before merge. Fix 2 should be resolved in the same pass.
Fix 3 is optional but recommended.
