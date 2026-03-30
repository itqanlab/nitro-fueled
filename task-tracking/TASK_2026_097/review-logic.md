# Code Logic Review — TASK_2026_097

## Score: 5/10

## Findings

### Critical (must fix)

- **Double-matching inflates confidence for single conceptual signals (SIMPLE_PATTERNS).** `/\bfix\s+typo\b/i` and `/\btypo\b/i` are two separate patterns in `SIMPLE_PATTERNS`. Any description containing "fix typo" matches both, producing `simpleScore = 2` and therefore `confidence = 'high'` — even though only one conceptual signal was present. The spec says single signal = low confidence. Verified: `estimateComplexity('fix typo')` returns `confidence: 'high'`, which violates the spec. The test at line 57 in the test file checks the analogous case for complex (`'scaffold'` → low confidence), but no equivalent test exists for simple, so this bug is invisible in the test suite. The `"fix typo in README"` test (line 74) only asserts `tier`, not confidence, allowing the bug to hide.

- **Double-matching inflates confidence for single conceptual signals (MEDIUM_PATTERNS).** `/\bimplement\s+service\b/i` and `/\bimplement\b/i` are both in `MEDIUM_PATTERNS`. Any description containing "implement service" matches both, giving `mediumScore = 2` and `confidence = 'high'` from a single conceptual signal. Verified: `estimateComplexity('implement service')` returns `confidence: 'high'`. The "implement new service" test (line 147) only asserts `tier`, not confidence.

- **Missing assertion: the `'single complex signal → low confidence'` pattern has no parallel test for simple or medium tiers.** Tests for `'scaffold'` and `'integrate'` single-signal cases explicitly assert `confidence: 'low'` (lines 57–67). No equivalent test exists for simple or medium tiers. This is the direct cause that the double-match confidence inflation bugs above are not caught.

### Major (should fix)

- **`signals[]` mixes matched text from all tiers with no tier label.** When both simple and complex signals fire (e.g., `'fix typo in scaffold documentation'`), the returned `signals` array contains `['fix typo', 'typo', 'scaffold']`. The consumer cannot tell which signals contributed to the final tier decision and which were overridden. This makes the output misleading for debugging or display. The spec only defines `signals: string[]`, so this is a design gap in the spec, but the implementation makes it worse by including overridden signals without annotation.

- **`/\barchitect/i` has no trailing word boundary.** The pattern matches "architect", "architecture", "architectural", and also "rearchitect". This is likely intentional (the task spec mentions "architecture" as a keyword), but it also means "the architect renamed a file" is classified as complex when it may be simple. No test covers this boundary case, and the pattern asymmetry versus the other COMPLEX_PATTERNS (which all use `\b` on both ends) is undocumented.

- **`simpleScore >= 1 && mediumScore === 0` condition ignores relative signal strength.** If a description has `simpleScore = 3` and `mediumScore = 1`, medium wins with `confidence: 'low'` (1 medium signal). The simple tier's 3-signal high-confidence match is completely discarded in favor of a single weak medium signal. Per the spec priority is correct (medium beats simple), but the confidence output `'low'` is misleading — the description has strong simple evidence that is silently discarded. This is a design ambiguity in the spec that the implementation resolves in a potentially confusing way.

- **No test for `confidence` on any simple or medium single-signal case.** The test suite has 8 tier-assertion tests for simple and medium patterns, zero of which assert the confidence value. The complex tier has two tests that explicitly assert `confidence: 'low'` for single signals (lines 57–67). This asymmetry means confidence correctness for simple and medium is completely untested.

### Minor (nice to fix)

- **`signals[]` can contain duplicate semantic content.** For `"fix typo and update config"`, signals is `['fix typo', 'update config', 'typo']`. The word `'typo'` is a sub-match of `'fix typo'`, cluttering the output. No deduplication or preference logic exists.

- **No test for `null` or `undefined` input.** `description.match(pattern)` will throw if `description` is `null` or `undefined`. The empty string is covered (line 229), but callers passing `null` (e.g., a task with no description field) will get an uncaught TypeError. Given that this is called during task creation where description could theoretically be absent, this is a real risk.

- **Test at line 206–213 is a duplicate of the test at line 183–188.** Both describe `"scaffold and integrate new pipeline"` and assert identical signal membership. One of these is redundant and should be removed.

- **`"fix a typo in the code"` (test line 106) yields `confidence: 'low'` (only `/\btypo\b/i` matches, not `/\bfix\s+typo\b/i` because "fix a typo" has "a" between the words).** This is correct behavior but the test does not assert confidence, hiding this nuance from readers.

- **The `'scaffold infrastructure'` test (line 252) is labelled "maps complex with high confidence to heavy" but `'scaffold infrastructure'` only has one complex signal (`scaffold`), so confidence is actually `low`, not high.** The test only asserts `preferredTier: 'heavy'`, so it passes, but the label is misleading.

## Summary

The core tier-selection logic and priority order (complex > medium > simple) are correct and well-tested. However, overlapping patterns within the same tier (`/\bfix\s+typo\b/i` + `/\btypo\b/i` in SIMPLE_PATTERNS; `/\bimplement\s+service\b/i` + `/\bimplement\b/i` in MEDIUM_PATTERNS) cause confidence to inflate to `'high'` from a single conceptual signal, directly violating the spec's "single signal = low confidence" rule. The test suite does not catch this because no confidence assertions exist for simple or medium single-signal cases.
