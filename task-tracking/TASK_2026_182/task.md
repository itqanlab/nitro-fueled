# Task: Remove Deprecated Code — getConfigPath, rxjs/operators Import, prebuild-install

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | REFACTORING |
| Priority              | P3-Low      |
| Complexity            | Simple      |
| Preferred Tier        | light       |
| Model                 | default     |
| Testing               | optional    |

## Description

Clean up three small deprecated items found during the RETRO_2026-03-30 deprecation scan:

1. **Remove `getConfigPath()` from CLI utils** — marked `@deprecated` with JSDoc, zero active callers. Delete the function entirely from `apps/cli/src/utils/provider-config.ts`.

2. **Fix `rxjs/operators` deep import** — `import { map } from 'rxjs/operators'` in the response envelope interceptor should be `import { map } from 'rxjs'`. The `/operators` sub-path is deprecated since RxJS v6.

3. **Upgrade `better-sqlite3`** — transitive dependency `prebuild-install@7.1.3` is deprecated ("No longer maintained"). Check if a newer `better-sqlite3` version drops this dependency; if so, bump the version in `apps/cli/package.json` and regenerate lock file.

## Dependencies

- None

## Acceptance Criteria

- [ ] `getConfigPath()` function removed from `provider-config.ts`
- [ ] No imports from `rxjs/operators` in any production source file
- [ ] `better-sqlite3` version bumped if a newer version resolves the `prebuild-install` deprecation (or documented as not actionable if still required)
- [ ] All tests pass, application compiles

## References

- Deprecation scan: RETRO_2026-03-30 workspace analysis

## File Scope

- apps/cli/src/utils/provider-config.ts
- apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts
- apps/cli/package.json (version bump)

## Parallelism

✅ Can run in parallel — touches isolated files with no overlap with other CREATED tasks
