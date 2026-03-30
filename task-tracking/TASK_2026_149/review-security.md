# Security Review — TASK_2026_149

## Review Summary

| Metric           | Value                                                                 |
|------------------|-----------------------------------------------------------------------|
| Overall Score    | 6/10                                                                  |
| Assessment       | REVISE                                                                |
| Critical Issues  | 0                                                                     |
| Serious Issues   | 1                                                                     |
| Minor Issues     | 1                                                                     |
| Files Reviewed   | 8                                                                     |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | Provider IDs are chosen from a fixed union/allowlist and Angular interpolation escapes rendered text. |
| Path Traversal           | PASS   | No filesystem access or path composition exists in the in-scope code. |
| Secret Exposure          | FAIL   | `maskApiKey()` leaks full short keys and almost all characters of short-to-medium keys, defeating the "masked values" requirement for some inputs. |
| Injection (shell/prompt) | PASS   | No shell execution, `eval`, `innerHTML`, or prompt-building sink exists in the reviewed files. |
| Insecure Defaults        | FAIL   | The API key entry field is a plain `type="text"` input, so pasted secrets are shown in cleartext during entry. |

| Verdict | FAIL |
|---------|------|

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: API key masking logic exposes full or nearly full secrets for shorter inputs

- **File**: `apps/dashboard/src/app/services/settings-provider.constants.ts:74-81`
- **Problem**: `maskApiKey()` returns the original value unchanged when `trimmedValue.length <= 8`. For values just above that threshold, it reveals the first 6 and last 4 characters regardless of total length, which means a 9-13 character secret exposes all or nearly all of the credential due to overlap and minimal hidden span. Examples: a 8-character token is stored and displayed in full; an 11-character token reveals 10 of 11 characters.
- **Impact**: This is a direct secret-exposure flaw in the primary credentials UI. Any provider token, test token, or future short-format credential entered through this flow can be disclosed in the on-screen list instead of being safely masked.
- **Fix**: Replace the masking strategy with one that always hides the majority of the secret. A safe default is to show only the last 4 characters, or at most a short non-secret prefix plus the last 4, while enforcing a minimum hidden segment for every non-empty input.

## Minor Issues

- **API key field uses cleartext input rendering** — `apps/dashboard/src/app/views/settings/api-keys/api-keys.component.html:28`. The credential field is `type="text"`, so pasted keys remain fully visible on screen while the user is entering them. This is not a storage leak like Issue 1, but it is still a weak default for secret entry. Use `type="password"` with an optional reveal toggle, and consider adding `autocomplete="off"` or `autocomplete="new-password"`, `spellcheck="false"`, and `autocapitalize="off"`.

## Notes on Specific Patterns

**Dynamic status classes** (`settings.component.html:35,56`, `api-keys.component.html:85`): the templates build CSS classes with `status-{{ ... }}`. In current scope the source values are TypeScript union members from mock state, so this is not an injection issue today. If these values later come from a live API, validate them at the deserialization boundary before rendering.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: `maskApiKey()` does not reliably mask secrets. Short credentials are displayed in full, and 9-13 character credentials expose almost every character.
