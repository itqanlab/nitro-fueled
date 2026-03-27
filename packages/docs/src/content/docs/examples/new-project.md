---
title: New Project
description: Set up Nitro-Fueled on a brand-new project from scratch.
---

This walkthrough takes a brand-new React + Node.js project from empty directory to three completed tasks — user authentication, Docker setup, and API documentation — processed by the Auto-Pilot Supervisor.

---

## Step 1: Bootstrap the Project

Create the project and initialize a basic React + Node.js structure:

```bash
mkdir my-app && cd my-app
git init
npm init -y
npm install react react-dom @types/react typescript
mkdir -p src/client src/server
echo '{"name":"my-app","dependencies":{"react":"^18.0.0","express":"^4.18.0"}}' > package.json
```

> **Note:** Nitro-Fueled works with any project structure. The key is having a `package.json` (or equivalent) so the stack detector can identify your framework.

---

## Step 2: Initialize Nitro-Fueled

```bash
npx nitro-fueled init
```

You will see output like:

```
Nitro-Fueled v0.1.0 initializing...

Detecting tech stack...
  Found: package.json
  Detected: React + Express/Node.js

Copying core agents...       ✓ 22 nitro-* agents installed
Copying skills...            ✓ 4 skills installed
Copying commands...          ✓ all slash commands installed
Copying anti-patterns.md...  ✓
Creating task-tracking/...   ✓

Generating project agents...
  frontend-developer.md      ✓ (React + TypeScript stack)
  backend-developer.md       ✓ (Node.js + Express stack)

Configuring .mcp.json...     ✓

Done! Run 'npx nitro-fueled status' to verify.
```

Verify the installation:

```bash
npx nitro-fueled status
# Output: Project configured. 0 tasks in registry. MCP server: reachable.
```

---

## Step 3: Write Three Tasks

Create the task folders and files:

```bash
mkdir -p task-tracking/TASK_2026_001
mkdir -p task-tracking/TASK_2026_002
mkdir -p task-tracking/TASK_2026_003
```

**Task 1: User Authentication (FEATURE)**

Create `task-tracking/TASK_2026_001/task.md`:

```markdown
# Task: Add user authentication

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | FEATURE  |
| Priority   | P1-High  |
| Complexity | Medium   |

## Description

Implement user authentication using JWT tokens. Users should be able to
register with email and password, log in, and receive a JWT token for
subsequent API requests. Store user records in a SQLite database. Protect
authenticated routes using a middleware that validates the JWT.

## Dependencies

- None

## Acceptance Criteria

- [ ] POST /api/auth/register creates a user and returns a JWT
- [ ] POST /api/auth/login validates credentials and returns a JWT
- [ ] Auth middleware rejects requests with invalid or expired tokens
- [ ] Passwords are hashed with bcrypt before storage

## References

- Express app entry: src/server/index.ts
```

**Task 2: Docker Setup (DEVOPS)**

Create `task-tracking/TASK_2026_002/task.md`:

```markdown
# Task: Add Docker configuration

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | DEVOPS   |
| Priority   | P2-Medium |
| Complexity | Simple   |

## Description

Add a Dockerfile for the Node.js backend and a docker-compose.yml for local
development. The Docker setup should support hot-reload in development mode
and produce an optimized production image.

## Dependencies

- TASK_2026_001 — app structure must be defined before dockerizing

## Acceptance Criteria

- [ ] Dockerfile builds successfully
- [ ] docker-compose up starts the dev server with hot-reload
- [ ] Production image is under 200MB
- [ ] .dockerignore excludes node_modules and test files

## References

- Server entry: src/server/index.ts
```

**Task 3: API Documentation (DOCUMENTATION)**

Create `task-tracking/TASK_2026_003/task.md`:

```markdown
# Task: Write API documentation

## Metadata

| Field      | Value         |
|------------|---------------|
| Type       | DOCUMENTATION |
| Priority   | P2-Medium     |
| Complexity | Simple        |

## Description

Document the authentication API endpoints introduced in TASK_2026_001.
Write an OpenAPI 3.0 spec file (openapi.yaml) covering the /register and
/login endpoints with request/response schemas and example payloads.

## Dependencies

- TASK_2026_001 — auth endpoints must exist before documenting them

## Acceptance Criteria

- [ ] openapi.yaml validates against the OpenAPI 3.0 schema
- [ ] Both /register and /login endpoints are documented
- [ ] Request and response schemas include all fields
- [ ] Example payloads are included

## References

- Auth routes: src/server/routes/auth.ts (created by TASK_2026_001)
```

Initialize the status files:

```bash
echo -n "CREATED" > task-tracking/TASK_2026_001/status
echo -n "CREATED" > task-tracking/TASK_2026_002/status
echo -n "CREATED" > task-tracking/TASK_2026_003/status
```

---

## Step 4: Run Auto-Pilot

Make sure iTerm2 is open, then start the Supervisor:

```bash
npx nitro-fueled run
```

The Supervisor builds the dependency graph and identifies the waves:

```
Building dependency graph...
  Wave 1: TASK_2026_001 (no deps)
  Wave 2: TASK_2026_002 (depends on TASK_2026_001)
           TASK_2026_003 (depends on TASK_2026_001)

Spawning Wave 1...
  → Build Worker for TASK_2026_001 (iTerm2 tab: "TASK_2026_001-auth")

Monitoring... (next check in 5 minutes)
```

After TASK_2026_001 reaches `IMPLEMENTED`, the Review Worker spawns automatically:

```
TASK_2026_001 → IMPLEMENTED (Build Worker finished)
Spawning Review Worker for TASK_2026_001...

TASK_2026_001 → COMPLETE (Review Worker passed)
Spawning Wave 2...
  → Build Worker for TASK_2026_002 (iTerm2 tab: "TASK_2026_002-docker")
  → Build Worker for TASK_2026_003 (iTerm2 tab: "TASK_2026_003-docs")
```

Tasks 2 and 3 run in parallel since they share the same wave and do not conflict.

---

## Step 5: Review the Output

When all tasks reach `COMPLETE`, check the results:

```bash
npx nitro-fueled status
```

```
Project Status
==============

| Task ID | Title | Type | Priority | Status |
|---------|-------|------|----------|--------|
| TASK_2026_001 | Add user authentication | FEATURE | P1-High | COMPLETE |
| TASK_2026_002 | Add Docker configuration | DEVOPS | P2-Medium | COMPLETE |
| TASK_2026_003 | Write API documentation | DOCUMENTATION | P2-Medium | COMPLETE |

Session total: 3 tasks, ~$18.40, ~2.5 hours
```

Read the completion report for the auth task:

```bash
cat task-tracking/TASK_2026_001/completion-report.md
```

```markdown
# Completion Report — TASK_2026_001

## Summary

User authentication implemented with JWT tokens and bcrypt password hashing.

## Files Created

- src/server/routes/auth.ts — register and login endpoints
- src/server/middleware/auth.middleware.ts — JWT validation middleware
- src/server/models/user.model.ts — User database model
- src/server/utils/jwt.ts — Token generation and validation

## Git Commits

- a1b2c3d feat(auth): implement user registration endpoint
- d4e5f6a feat(auth): implement login and JWT middleware

## Acceptance Criteria Verification

- [x] POST /api/auth/register creates a user and returns a JWT
- [x] POST /api/auth/login validates credentials and returns a JWT
- [x] Auth middleware rejects requests with invalid or expired tokens
- [x] Passwords are hashed with bcrypt before storage

## Review Findings

Logic review: APPROVED (no stubs, full error handling present)
Style review: 2 minor findings fixed (import ordering, missing return types)
Security review: APPROVED (no injection vulnerabilities, secrets in env vars)
```

---

## See Also

- [Existing Project Example](existing-project/) — Adding Nitro-Fueled to a project already in progress
- [Task Format Reference](../task-format/) — Full `task.md` field documentation
- [Auto-Pilot Guide](../auto-pilot/) — Configuration and monitoring details
