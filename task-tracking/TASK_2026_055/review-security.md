# Security Review — TASK_2026_055

## Review Summary

| Metric           | Value                          |
|------------------|-------------------------------|
| Overall Score    | 7/10                          |
| Assessment       | NEEDS_REVISION                |
| Critical Issues  | 0                             |
| Serious Issues   | 1                             |
| Minor Issues     | 2                             |
| Files Reviewed   | 5                             |

## OWASP Checklist Results

| Category                 | Status | Notes                                                                              |
|--------------------------|--------|------------------------------------------------------------------------------------|
| Input Validation         | PASS   | No user-controlled input in any reviewed file                                      |
| Path Traversal           | PASS   | No dynamic file paths constructed in any reviewed file                             |
| Secret Exposure          | PASS   | No tokens, API keys, or credentials found                                          |
| Injection (shell/prompt) | PASS   | No shell commands, no eval, no unquoted variables                                  |
| Insecure Defaults        | FAIL   | GitHub Actions use floating version tags (not SHA-pinned); no CSP meta tag present |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: GitHub Actions Use Floating Version Tags — No SHA Pinning

- **File**: `.github/workflows/docs.yml` lines 26, 29, 40, 47, 61
- **Problem**: All five `uses:` references pin to a mutable version tag (`@v4`, `@v3`) rather than an immutable commit SHA. A tag can be force-pushed by the action's maintainer (or a compromised maintainer account) to point to different code at any time. The next workflow run will silently execute the new code under the existing `id-token: write` permission.
- **Impact**: The `id-token: write` permission is the most sensitive permission present — it allows the workflow to mint an OIDC token that authenticates to GitHub's Pages deployment API. Malicious action code could exfiltrate this token or redirect the deployment. This is the canonical supply-chain attack vector for GitHub Actions.
- **Fix**: Replace each tag reference with a pinned SHA. For example:
  ```yaml
  uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
  uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af  # v4.1.0
  uses: actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b  # v4.0.0
  uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa  # v3.0.1
  uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e  # v4.0.5
  ```
  Look up the current canonical SHAs from each action's official release tags and commit them. Add an inline comment with the version for human readability.

## Minor Issues

- **No Content Security Policy on the landing page**: `packages/docs/src/pages/index.astro` has no `<meta http-equiv="Content-Security-Policy">` tag. The page has zero inline scripts and loads no external resources, so the practical XSS blast radius is currently nil. However, the full landing page (TASK_2026_056) is planned, and a future developer may add scripts or CDN resources without adding a CSP. Adding a restrictive baseline now (e.g., `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'`) is low-effort and establishes a safe baseline before the page grows. Since this is a GitHub Pages static site, the policy must be delivered as a `<meta>` tag — no server-side header is available.

- **`sharp` dependency pinned only to a semver range**: `packages/docs/package.json` line 15 — `"sharp": "^0.33.0"`. `sharp` is a native C++ binding library (libvips) with a history of vulnerability disclosures (CVE-2023-4863 for libvips's WebP dependency). The `^` range means `npm ci` will install the highest compatible version available at build time, which could pull an unpatched release if a new CVE is disclosed between releases. Pin to an exact version (e.g., `"sharp": "0.33.5"`) and update deliberately after reviewing the changelog and any associated CVEs. The same applies to `astro`, `@astrojs/starlight`, and other dependencies, but `sharp` is the highest-risk package due to native code processing of image data.

## Positive Notes

- Workflow permissions are correctly scoped: `contents: read` (not `write`), `pages: write`, and `id-token: write` are the minimum set required for a GitHub Pages deployment. No `write-all` or `secrets: inherit` in scope.
- The workflow uses `push` to `main` only, not the dangerous `pull_request_target` event. External contributors cannot trigger the deployment job.
- `concurrency.cancel-in-progress: false` is correctly set for the deployment group, preventing a race that could leave the site in a partially-deployed state.
- The landing page (`index.astro`) contains no inline JavaScript, no external script or font loading, and no dynamic content rendering. Its XSS surface area is zero in its current form.
- The CSS file (`custom.css`) uses only CSS custom properties and Tailwind directives. No `url()` calls to external resources, no `@import` from CDNs.
- The Astro config has no `server.host: '0.0.0.0'` or equivalent — dev server defaults to localhost only.
- No hardcoded secrets, tokens, or credentials anywhere in the reviewed files.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Floating GitHub Actions version tags under `id-token: write` permission — a compromised or force-pushed action tag could exfiltrate OIDC tokens during the next workflow run. Pin all five action references to commit SHAs before this workflow is relied upon in production.
