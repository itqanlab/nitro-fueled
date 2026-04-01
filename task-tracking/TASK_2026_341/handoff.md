# Handoff — TASK_2026_341

## Files Changed
- apps/dashboard/src/app/services/websocket.service.ts (modified, +30 -8)

## Commits
- (see implementation commit)

## Decisions
- Used `BehaviorSubject` (not plain `Subject`) for `connectionStatus$` so late subscribers (e.g. UI indicators mounted after connect fires) always receive the current state immediately
- socket.io `reconnectionDelay` / `reconnectionDelayMax` / `randomizationFactor` combination produces exponential backoff with jitter — consistent with industry defaults
- `reconnect_attempt` event maps to `'reconnecting'` status — clearer than a boolean `isReconnecting` for UI display
- Exported `ConnectionStatus` type so consumer components can import the union without repeating it

## Known Risks
- socket.io version differences may rename `reconnect_attempt` — current version confirmed to support this event
- `connectionStatus$` starts as `'disconnected'`; initial `connect` event fires asynchronously, so there is a brief window where status is `disconnected` even after constructor runs
