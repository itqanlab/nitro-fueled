---
title: Existing Project
description: Add Nitro-Fueled to a project that is already in flight.
---

This walkthrough adds Nitro-Fueled to an existing Python/FastAPI backend service and uses it to investigate and fix a race condition in an async endpoint. You will see how the stack detection generates a Python-specific developer agent and how a single-task run works for a focused bug fix.

---

## Step 1: The Existing Project

We have a FastAPI service that has been running in production for several months. The project structure looks like this:

```
my-api/
  app/
    main.py
    routers/
      orders.py
      users.py
    services/
      order_service.py
    models/
      order.py
    database.py
  requirements.txt
  tests/
    test_orders.py
```

The `requirements.txt` includes:

```
fastapi==0.104.1
uvicorn==0.24.0
sqlalchemy==2.0.23
asyncpg==0.29.0
pytest==7.4.3
pytest-asyncio==0.21.1
```

There is an open bug: the `POST /orders/bulk` endpoint creates orders in a loop using async tasks, but under load two concurrent requests sometimes create duplicate order numbers because both read the current max order number before either commits.

---

## Step 2: Initialize Nitro-Fueled

From the project root:

```bash
cd my-api
npx nitro-fueled init
```

The installer detects the Python stack:

```
Nitro-Fueled v0.1.0 initializing...

Detecting tech stack...
  Found: requirements.txt
  Detected: Python + FastAPI + SQLAlchemy

Copying core agents...       ✓ 22 nitro-* agents installed
Copying skills...            ✓ 4 skills installed
Copying commands...          ✓ all slash commands installed
Copying anti-patterns.md...  ✓
Creating task-tracking/...   ✓

Generating project agents...
  backend-developer.md       ✓ (Python + FastAPI + SQLAlchemy stack)

Note: No frontend stack detected. frontend-developer.md not generated.

Configuring .mcp.json...     ✓

Done! Run 'npx nitro-fueled status' to verify.
```

The generated `backend-developer.md` includes Python-specific patterns: SQLAlchemy async session management, FastAPI dependency injection, pytest-asyncio test conventions, and Alembic migration guidance. This is the agent the Team-Leader will assign for implementation work.

---

## Step 3: Write the BUGFIX Task

Create the task folder:

```bash
mkdir -p task-tracking/TASK_2026_001
```

Create `task-tracking/TASK_2026_001/task.md`:

```markdown
# Task: Fix race condition in bulk order creation

## Metadata

| Field      | Value      |
|------------|------------|
| Type       | BUGFIX     |
| Priority   | P1-High    |
| Complexity | Medium     |

## Description

The POST /orders/bulk endpoint creates multiple orders in parallel using
asyncio.gather(). Under concurrent load, two requests can both read the
current maximum order_number before either transaction commits, resulting
in duplicate order numbers and a unique constraint violation in the database.

The fix should serialize order number assignment within each request using a
database-level advisory lock or a SELECT FOR UPDATE on the sequence row.
The fix must not reduce throughput for single-order creation (POST /orders/).

## Dependencies

- None

## Acceptance Criteria

- [ ] Concurrent bulk order requests do not produce duplicate order numbers
- [ ] Unique constraint violations no longer occur under load
- [ ] Single-order creation (POST /orders/) is unaffected
- [ ] Existing test_orders.py tests continue to pass
- [ ] A new async test covers concurrent bulk creation

## References

- Affected endpoint: app/routers/orders.py (bulk_create_orders function)
- Order service: app/services/order_service.py
- Database session: app/database.py
- Existing tests: tests/test_orders.py
```

Initialize the status file:

```bash
echo -n "CREATED" > task-tracking/TASK_2026_001/status
```

---

## Step 4: Run the Single Task

Since this is a targeted fix, use single-task orchestration rather than the full Auto-Pilot loop:

```bash
npx nitro-fueled run TASK_2026_001
```

Or from inside Claude Code:

```
/orchestrate TASK_2026_001
```

Because the task type is `BUGFIX`, the Orchestrator skips the full PM scoping phase and goes directly to investigation and implementation:

```
TASK_2026_001 — BUGFIX pipeline
  Skipping PM phase (BUGFIX type)
  Phase 1: Investigation → reading order_service.py, database.py
  Phase 2: Team-Leader decomposing...
    Batch 1: Fix order number assignment in order_service.py
    Batch 2: Add concurrent test to test_orders.py
  Phase 3: Developer implementing Batch 1...
  Phase 4: Team-Leader verifying Batch 1, committing...
  Phase 5: Developer implementing Batch 2...
  Phase 6: Team-Leader verifying Batch 2, committing...
  Phase 7: QA Review Workers spawning...
```

---

## Step 5: Review the Completion Report

When the task reaches `COMPLETE`:

```bash
cat task-tracking/TASK_2026_001/completion-report.md
```

```markdown
# Completion Report — TASK_2026_001

## Summary

Fixed race condition in bulk order creation by introducing a PostgreSQL
advisory lock on order number assignment within order_service.py. Orders
within a bulk request are now assigned numbers sequentially under the lock,
preventing concurrent requests from reading the same max value.

## Files Modified

- app/services/order_service.py — added _assign_order_numbers() with
  advisory lock using pg_advisory_xact_lock(hashtext('order_numbers'))
- tests/test_orders.py — added test_concurrent_bulk_create() covering
  10 concurrent bulk requests with order number uniqueness assertion

## Git Commits

- 7a8b9c0 fix(orders): serialize order number assignment with advisory lock
- 1d2e3f4 test(orders): add concurrent bulk creation test

## Root Cause

order_service.bulk_create() called _get_next_order_number() inside each
coroutine without a transaction lock. SELECT MAX(order_number) + 1 was
non-atomic — two coroutines could read the same MAX before either committed.

## Fix Applied

Replaced per-order number reads with a single locked batch assignment:
- acquire pg_advisory_xact_lock before reading MAX
- assign all numbers for the batch while lock is held
- release on transaction commit

## Acceptance Criteria Verification

- [x] Concurrent bulk order requests do not produce duplicate order numbers
- [x] Unique constraint violations no longer occur under load
- [x] Single-order creation (POST /orders/) is unaffected
- [x] Existing test_orders.py tests continue to pass
- [x] New async test covers concurrent bulk creation

## Review Findings

Logic review: APPROVED — fix is correct, lock scope is appropriate
Style review: APPROVED — follows existing async patterns in the codebase
Security review: APPROVED — no new attack surface introduced
```

---

## Step 6: Check the Code Changes

```bash
git log --oneline -3
# 1d2e3f4 test(orders): add concurrent bulk creation test
# 7a8b9c0 fix(orders): serialize order number assignment with advisory lock
# [previous commit]

git show 7a8b9c0 --stat
# app/services/order_service.py | 28 ++++++++++++++++++----
# 1 file changed, 24 insertions(+), 4 deletions(-)
```

The fix is committed with structured commit messages referencing the task type and scope. The Review Worker validated logic, style, and security before marking the task `COMPLETE`.

---

## Next Steps for This Project

With Nitro-Fueled installed, you can now use the Planner to map out the next set of improvements:

```
/plan
```

The Planner will read your existing codebase, ask about your priorities, and propose right-sized tasks for your approval before writing any files.

---

## See Also

- [New Project Example](new-project/) — Full walkthrough with Auto-Pilot and multiple tasks
- [Task Format Reference](../task-format/) — All task type pipelines and field definitions
- [Commands Reference](../commands/) — `/plan`, `/orchestrate`, `npx nitro-fueled run`
