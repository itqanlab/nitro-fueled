import { truncate, capitalize, slugify } from './string-utils';

// Simple test helpers -- no external test framework required

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `FAIL: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`
    );
  }
}

// ---------------------------------------------------------------------------
// truncate tests
// ---------------------------------------------------------------------------

// These PASS with buggy code (no truncation needed):
assertEqual(truncate('Hi', 10), 'Hi', 'truncate: no truncation when under limit');
assertEqual(truncate('Hello', 5), 'Hello', 'truncate: no truncation at exact limit');

// This FAILS with buggy code:
// Buggy code returns "Hello Wo..." (length 11) instead of "Hello..." (length 8)
// because it slices at maxLength (8) then appends "...", giving length 11.
// Correct: slice at maxLength - 3 (= 5) -> "Hello" + "..." = "Hello..." (exactly 8 chars)
assertEqual(
  truncate('Hello World', 8),
  'Hello...',
  'truncate: truncated output length should be exactly maxLength'
);

// ---------------------------------------------------------------------------
// capitalize tests
// ---------------------------------------------------------------------------

// This PASSES with buggy code (single spaces are fine):
assertEqual(capitalize('hello world'), 'Hello World', 'capitalize: basic case');

// This PASSES with buggy code (empty string handled correctly):
assertEqual(capitalize(''), '', 'capitalize: empty string');

// This FAILS with buggy code:
// Buggy code filters out empty strings from split(' '), collapsing double spaces
// Returns "Hello World" (one space) instead of "Hello  World" (two spaces)
assertEqual(
  capitalize('hello  world'),
  'Hello  World',
  'capitalize: preserves multiple spaces'
);

// ---------------------------------------------------------------------------
// slugify tests
// ---------------------------------------------------------------------------

// This PASSES with buggy code (no special or accented characters):
assertEqual(slugify('Hello World'), 'hello-world', 'slugify: basic case');

// This PASSES with buggy code:
// The "!" is replaced with "-" by the regex, producing "hello-world-", but the
// trailing hyphen cleanup regex trims it to "hello-world". The real bug is with
// accented characters below.
assertEqual(slugify('Hello World!'), 'hello-world', 'slugify: strips special characters');

// This FAILS with buggy code:
// The accented \u00e9 (e with acute accent) is not in [a-z0-9\s-], so the regex
// replaces it with "-". "caf\u00e9" becomes "caf-", producing "caf-latt-" -> "caf-latt"
// instead of "cafe-latte"
assertEqual(
  slugify('Caf\u00e9 Latt\u00e9'),
  'cafe-latte',
  'slugify: handles accented characters'
);

console.log('All tests passed!');
