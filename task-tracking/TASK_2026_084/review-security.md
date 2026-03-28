# Security Review — TASK_2026_084

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Commit:** `93fae9d feat(dashboard): implement Project Onboarding view with wizard and chat panel`
**Verdict:** NEEDS ATTENTION — 2 medium findings, 2 low findings

---

## Summary

The implementation is a pure presentation layer with no API calls, no authentication/authorization code, and no direct DOM manipulation outside of Angular's binding system. The primary security concern is the use of `[innerHTML]` bindings to render both user-supplied chat input and AI-sourced recommendation text as HTML. Angular's built-in `DomSanitizer` provides automatic sanitization for `[innerHTML]` (stripping `<script>`, event handlers, etc.), so there is no immediate exploitable XSS in the current mock-data state. However, the architectural pattern is dangerous and will become a real attack surface when connected to live API data.

---

## Findings

### [MEDIUM] SEC-001 — User Chat Input Rendered as HTML via `[innerHTML]`

**File:** `chat-panel/chat-panel.component.html:23`
**Related:** `onboarding.component.ts:143-148`

```html
<!-- chat-panel.component.html:23 -->
<div class="chat-msg-bubble" [innerHTML]="msg.text"></div>
```

```typescript
// onboarding.component.ts:143-148
public onChatMessage(text: string): void {
  this.chatMessages.update((msgs) => [
    ...msgs,
    { sender: 'user' as const, text, time: ... },
  ]);
}
```

**Risk:** User-typed text is appended to `chatMessages` as-is and rendered via `[innerHTML]`. Angular's `DomSanitizer` automatically sanitizes this (strips `<script>`, inline event handlers like `onclick`), so no script execution occurs in the current implementation. However:

1. Angular's sanitizer does **not** strip all dangerous vectors — it allows safe HTML elements and certain attributes. Crafted payloads using CSS injection or data URIs may survive sanitization depending on the Angular version.
2. When `ChatMessage.text` is populated from an API response (the production path), any server-side injection or SSRF-sourced HTML would be rendered directly in the chat bubble, subject only to Angular's client-side sanitizer.
3. The user's plain-text chat input has no semantic need to be rendered as HTML. Plain text interpolation (`{{ msg.text }}`) is sufficient and inherently safe — it never executes markup.

**Recommendation:** Replace `[innerHTML]="msg.text"` with `{{ msg.text }}` for user-sender messages. If AI responses genuinely require HTML formatting (`<strong>`, etc.), restrict innerHTML rendering to `msg.sender === 'ai'` messages only and document that the API is responsible for sanitizing AI output before returning it.

---

### [MEDIUM] SEC-002 — AI Recommendation Descriptions Rendered as HTML via `[innerHTML]`

**File:** `onboarding.component.html:112-116`

```html
<div
  class="ai-rec-content"
  [class.ai-rec-content-muted]="rec.isLoading || rec.isPending"
  [innerHTML]="rec.description"
></div>
```

**Risk:** `rec.description` contains raw HTML strings (e.g., `'Detected <strong>8 technologies</strong>...'`). In the current implementation these are hardcoded in the component, so the content is trusted. When this moves to live API data, the descriptions will arrive as HTML from the server and be rendered directly in the DOM.

If the backend API is ever compromised, returns unexpected data, or is the target of a stored XSS attack (e.g., via a malicious project file that influences AI output), the resulting HTML will be rendered in the user's browser with Angular's sanitizer as the only defense.

**Recommendation:** Either (a) have the API return plain text and apply Markdown-to-safe-HTML conversion with a vetted library (e.g., `marked` + `DOMPurify`), or (b) if HTML rendering is required, enforce server-side sanitization before the API response is served, and add a comment at this binding site noting the trust boundary and sanitization contract.

---

### [LOW] SEC-003 — Local Filesystem Paths Exposed in Rendered Content

**File:** `onboarding.component.ts:36, 41, 109`

```typescript
public readonly projectPath = '/Users/dev/projects/e-commerce-api';

public readonly externalRefs = [
  { type: 'url', value: 'https://figma.com/file/abc123/e-commerce-designs' },
  { type: 'file', value: '/Users/dev/docs/api-requirements.pdf' },
];

// chatMessages line 109:
{ sender: 'ai', text: '...at <strong>/Users/dev/projects/e-commerce-api</strong>...' }
```

**Risk:** These are mock data values that will be replaced by API data in production. However, the hardcoded paths reveal OS type (`/Users/dev/...` — macOS), internal directory structure, and file naming conventions. The path in `chatMessages` is rendered via `[innerHTML]` (SEC-002), making it visible in the DOM. In a real app, local filesystem paths passed back from an API to a frontend reveal server-side or developer machine paths to any authenticated user who inspects the response — a low-severity information disclosure.

**Recommendation:** For mock data, use generic placeholder paths (e.g., `/projects/my-app`) that do not reveal real OS or directory structures. In production, paths should come from the API and be scoped to project identifiers, not absolute filesystem paths.

---

### [LOW] SEC-004 — Unvalidated `ExternalReference.value` at Model Level

**File:** `apps/dashboard/src/app/models/onboarding.model.ts:8-11`

```typescript
export interface ExternalReference {
  readonly type: 'url' | 'file';
  readonly value: string;
}
```

**Risk:** `value` is an unconstrained string. In the template, `externalRefs` are rendered via `[value]="ref.value"` on `<input readonly>` elements — this is safe from XSS (Angular binds the value property, not innerHTML). However, if this model is ever used to construct a navigation (`router.navigate`, `window.open`, `<a [href]>`, or API calls), an unvalidated URL/path string could be exploited for open redirect or SSRF. The model provides no validation contract at the type level.

**Risk is currently theoretical** — the template renders these as read-only input values only, with no href or navigation binding. Flag for when this component becomes interactive.

**Recommendation:** When `ExternalReference.value` is ever used in a navigation or API context, validate the `type === 'url'` case against an allowlist of protocols (`https://` only) before use. Consider adding a `URL` parse guard at the point of consumption.

---

## Non-Findings (Explicitly Checked)

| Check | Result |
|---|---|
| `bypassSecurityTrustHtml()` usage | Not present — Angular sanitizer is active on all `[innerHTML]` bindings |
| `[href]` bindings with dynamic data | Not present |
| `window.open` / `eval` / `document.write` | Not present |
| SQL injection / command injection | Not applicable — no API calls in scope |
| CSRF tokens | Not applicable — no API calls in scope |
| Hardcoded secrets / API keys | Not present |
| Sensitive data in `console.log` | Not present |
| `[style]` injection via `folder-tree` indent | `node.indent * 16` — numeric arithmetic limits this to a safe CSS pixel value; no injection path |
| `[ngClass]="msg.sender"` | `sender` is `'ai' | 'user'` (typed union) — no CSS class injection risk |
| `(event.target as HTMLSelectElement).value` lookup | Used only to find a matching client object from a local readonly array — no injection path |

---

## Risk Matrix

| ID | Severity | OWASP Category | Exploitable Now | Exploitable in Production |
|---|---|---|---|---|
| SEC-001 | Medium | A03 Injection (XSS) | No (Angular sanitizer active) | Yes (user input → HTML render) |
| SEC-002 | Medium | A03 Injection (XSS) | No (hardcoded data) | Yes (API data → HTML render) |
| SEC-003 | Low | A01 Info Disclosure | No | Low (path exposure in responses) |
| SEC-004 | Low | A01 Info Disclosure | No | Theoretical (no navigation use yet) |
