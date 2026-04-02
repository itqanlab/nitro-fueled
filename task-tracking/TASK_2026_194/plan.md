# Plan — TASK_2026_194

1. Add a shared session ID helper that generates canonical IDs and normalizes legacy underscore IDs.
2. Apply normalization at MCP boundaries for session retrieval, task claims, worker/session queries, and session summaries/events that read or persist `session_id`.
3. Update orchestration guidance so new orchestration session IDs use the canonical `T` separator.
4. Add focused regression tests for legacy lookup and claim flows, then run `npm test` and `npm run build` in `packages/mcp-cortex`.
