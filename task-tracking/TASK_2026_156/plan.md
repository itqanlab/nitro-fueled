# Plan — TASK_2026_156

## Architecture

1. Add a focused NestJS `auto-pilot` module with a controller for the three mock endpoints and a small service that owns the mock state transition logic.
2. Extend dashboard API types and the Angular `ApiService` with typed request and response contracts for auto-pilot start, stop, and status calls.
3. Update the project page to manage an `idle -> starting -> running` state machine, invoke the start endpoint once, and poll the mock status endpoint until the running state is reached.

## Notes

- The mock service should avoid silent fallbacks and validate request bodies before use.
- The polling implementation must clean up subscriptions on component destroy and before re-subscribing.
- No additional UI surface is required beyond the existing button state unless error handling needs a small inline message.
