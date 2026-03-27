# Security Review — TASK_2026_056

## Score: 8/10

## Findings

### Critical (must fix)

No critical issues found.

---

### Major (should fix)

#### Issue 1: Google Fonts loaded without Subresource Integrity (SRI)

- **File**: `packages/docs/src/pages/index.astro:12-14`
- **Problem**: Two `<link>` tags load resources from `fonts.googleapis.com` and `fonts.gstatic.com` without `integrity` and `crossorigin="anonymous"` SRI attributes. If Google's CDN is compromised or the resource URL is hijacked via DNS or BGP attack, a malicious stylesheet could be served to visitors.
- **Impact**: Supply-chain style injection. An attacker who can tamper with the CDN response could inject CSS that exfiltrates keystrokes via attribute selectors, overlays phishing UI, or hides content. This is low-probability but the attack class is real and documented.
- **Fix**: Add `integrity` hashes. For Google Fonts, the canonical approach is to self-host the fonts (download via `google-webfonts-helper` and serve from `public/fonts/`). Self-hosting removes the CDN trust requirement entirely and also improves performance/privacy by eliminating a third-party DNS lookup. Alternatively, generate SRI hashes for the specific font URLs and pin them — but Google Fonts URLs return versioned content and hashes must be refreshed on each font update.

---

#### Issue 2: Inline scripts and styles prevent a strict Content Security Policy

- **File**: `packages/docs/src/pages/index.astro:15-223` (inline style block), `packages/docs/src/pages/index.astro:853-958` (inline script block)
- **Problem**: All JavaScript and CSS for this page are delivered as inline `<script>` and `<style>` blocks. A strict CSP (`script-src 'self'`; `style-src 'self'`) would block both without a nonce or hash. This is not a live vulnerability but it means the page cannot be deployed with a meaningful CSP without additional build tooling.
- **Impact**: If an XSS vector is introduced in the future (e.g., via a CMS, dynamic content injection, or a dependency), there is no CSP backstop. The absence of a deployable CSP is a defense-in-depth gap, not an active attack surface today.
- **Fix**: Two paths:
  1. Move the `<script>` block to an external `.js` file under `src/` and let Astro bundle it — Astro's build pipeline will emit the script as an external asset eligible for `script-src 'self'`. The `<style>` block can similarly move to a `.css` file or a scoped Astro style.
  2. If inline is preferred, configure Astro (or the hosting layer — Netlify, GitHub Pages, etc.) to emit a `Content-Security-Policy` header with `'unsafe-inline'` explicitly acknowledged, so the security posture is a documented, intentional choice rather than an oversight.

---

### Minor (advisory)

#### Minor 1: Missing `crossorigin` attribute on the `fonts.gstatic.com` preconnect

- **File**: `packages/docs/src/pages/index.astro:13`
- **Problem**: The `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` at line 13 uses a bare `crossorigin` attribute (which is equivalent to `crossorigin="anonymous"`). This is correct for CORS font fetches. The companion preconnect at line 12 (`fonts.googleapis.com`) does not carry `crossorigin`, which is also correct since the CSS fetch itself is not a CORS request. No action needed — noted for completeness.
- **Impact**: None.
- **Fix**: No fix required.

#### Minor 2: No `<meta http-equiv="Content-Security-Policy">` meta tag

- **File**: `packages/docs/src/pages/index.astro:8-14` (head section)
- **Problem**: There is no CSP meta tag and no documented server-header CSP policy. For a static marketing page hosted on GitHub Pages (which cannot set custom HTTP headers), a `<meta http-equiv="Content-Security-Policy">` tag is the only available CSP mechanism.
- **Impact**: Informational. No active risk given the page has no user-controlled output. Adds defense-in-depth if the page grows.
- **Fix**: Add a CSP meta tag that at minimum covers the current surface:
  ```html
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none';" />
  ```
  The `'unsafe-inline'` allowances here reflect the current inline-script/style architecture and should be tightened if scripts are externalized.

---

## Summary

This is a static marketing page with no server-side logic, no user-controlled data paths, no authentication, and no dynamic content rendering. The XSS attack surface is essentially zero for the current implementation.

All external links with `target="_blank"` correctly carry `rel="noopener noreferrer"` (lines 250-253, 291-293, 796-798, 836-839). No `set:html`, `innerHTML`, or `dangerouslySetInnerHTML` is used anywhere. No secrets or tokens are present. The Clipboard API usage is hardcoded to a fixed string and properly guarded with try/catch. The `baseUrl` variable inserted into `href` attributes comes from Astro's build-time `import.meta.env.BASE_URL` — not from user input.

The two major findings are supply-chain and defense-in-depth concerns rather than active vulnerabilities. The most actionable fix is self-hosting the Inter font to eliminate the Google Fonts CDN dependency.

**Recommendation**: APPROVE with advisory fixes noted above before launch.
