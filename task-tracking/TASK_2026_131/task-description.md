# Task Description — TASK_2026_131

## User Request
Add authentication guard to NestJS WebSocket Gateway (`DashboardGateway`) to prevent unauthorized access to dashboard session, cost, task, and analytics data.

## Task Type
BUGFIX - Security vulnerability (OWASP A01 Broken Access Control)

## Scope
- Add token validation in `handleConnection` before emitting any data
- Create WebSocket authentication guard (`WsAuthGuard`)
- Wire guard via NestJS `@UseGuards()` decorator
- Reject unauthorized connections with `client.disconnect()`
- Add integration tests for authentication flow

## Out of Scope
- Full user authentication system (user accounts, login flow)
- Token refresh/renewal mechanism
- Permission-based authorization (all authorized clients get full access)

## Dependencies
- TASK_2026_109 (API Contract Layer) - COMPLETE

## Risk Level
CRITICAL - Any client that knows the server address can receive all dashboard data without authentication

## Estimated Effort
2-4 hours (Medium complexity)