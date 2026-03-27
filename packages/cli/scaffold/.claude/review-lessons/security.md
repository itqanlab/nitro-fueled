# Security Review Lessons

Security-specific patterns found during review cycles. Every security review agent reads this file before running its checklist.
Auto-updated after each security review. Append new findings — do not remove existing ones.

## Path Traversal

- **Static file servers built on `path.join` must boundary-check before `fs.readFile`** — `path.join(base, userInput)` does not sanitize `..` sequences. After constructing the full path, resolve both the full path and the base with `path.resolve` and verify the resolved full path starts with `resolvedBase + path.sep`. Skip this check and any `GET /assets/../../../../etc/passwd` style URL leaks arbitrary local files. (TASK_2026_022)
- **Chokidar-watched directories must guard against symlink escapes** — when a file watcher emits a path inside a watched directory, call `fs.realpathSync` on the path and verify the resolved path still starts with the watched directory root before reading the file. A symlink planted inside the watched directory by an attacker redirects the read to any file the process can access. (TASK_2026_022)

## CORS and WebSocket Origin Validation

- **Localhost-only HTTP APIs must not use `Access-Control-Allow-Origin: *`** — wildcard CORS makes the API reachable by any browser tab on the machine (no credentials required for GET requests). Restrict to the known client origin (e.g., `http://localhost:<port>`) or reject requests with non-localhost `Origin` headers at the handler level. (TASK_2026_022)
- **WebSocket servers must check the upgrade request's `Origin` header** — `new WebSocketServer({ server })` accepts all connections by default. In the `'connection'` handler, inspect `req.headers.origin` (the second argument) and close connections from non-localhost origins with `ws.close(1008, 'Forbidden origin')`. Failing to do this allows any browser page to subscribe to the event stream. (TASK_2026_022)

## Input Validation at CLI Boundaries

- **CLI port arguments must be range-validated before use** — `parseInt(value, 10)` accepts values like `99999` or `-1` that will cause an opaque runtime crash when passed to `server.listen`. Validate `port === 0 || (port >= 1 && port <= 65535)` immediately after parsing and exit with a clear message if invalid. Port 0 is a valid sentinel meaning "OS-assigned". (TASK_2026_022)
- **`JSON.parse` results must be runtime-validated before field access, not just `as`-cast** — casting `JSON.parse(content) as SomeType` provides no runtime protection. If the file contains unexpected shapes (e.g., `"dependencies": 42` instead of an object), spread operators and property access will produce incorrect results or throw. Use `unknown` + a type guard, or guard with `typeof obj.field === 'object' && obj.field !== null` before spreading. Even when a `try/catch` catches the eventual throw, detection logic silently returns the wrong answer. (TASK_2026_029)

## Shell Injection — `spawnSync` vs `exec`

- **Use `spawnSync`/`spawn` with an argument array, never `exec` with string concatenation** — `spawnSync('claude', ['-p', `/create-agent ${name}`])` passes arguments directly to `execve`; no shell is involved and metacharacters (`; && | $()`) are inert. `exec(\`claude -p /create-agent ${name}\`)` passes the string to `/bin/sh -c` where those characters are interpreted. Always prefer the array form when calling external processes with any variable content. (TASK_2026_029)

## React SPA — XSS and Dependency Hygiene

- **`marked` (and similar markdown-to-HTML libraries) must be wrapped in a DOMPurify sanitizer before use — or removed if unused** — `marked.parse(content)` returns raw HTML including XSS payloads. The output must only ever be set via `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(content)) }}`. A library that is installed but not yet called is still a hazard: a future developer will reach for the already-imported package without knowing the safety wrapper is mandatory. Either remove the dependency or document the safe pattern in a shared utility at the API boundary. (TASK_2026_023)
- **WebSocket event payload fields used in API calls must be runtime-validated before use** — casting `event.payload.taskId as string` provides no runtime protection. A malformed or attacker-controlled payload can supply a `taskId` containing path segments (`../state`) or query strings (`foo?admin=true`), redirecting the fetch to an unintended endpoint. Validate that the value matches the expected format (e.g., `/^TASK_\d{4}_\d{3}$/`) before concatenating into a URL. (TASK_2026_023)
- **SPAs that render server data should include a Content Security Policy** — without a CSP, any XSS that does occur has unrestricted script execution. A `<meta http-equiv="Content-Security-Policy">` tag in `index.html` or a server-emitted `Content-Security-Policy` header confines the blast radius. For inline-style-heavy React apps, `style-src 'self' 'unsafe-inline'` is typically required, but `script-src 'self'` blocks inline script injection. (TASK_2026_023)
