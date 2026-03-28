# Benchmark Task: Cross-Cutting Change -- Structured Logger

## Metadata

| Field          | Value   |
|----------------|---------|
| Difficulty     | hard    |
| Type           | feature |
| Estimated Time | 30m     |
| Setup Required | yes     |

## Description

An existing codebase has four source files. A naive `src/logger.ts` re-exports `console.log`, `console.warn`, and `console.error` as bare references and provides a `createLogger` factory that returns a plain object with console wrappers. Three service files (`user-service.ts`, `order-service.ts`, `payment-service.ts`) perform ad-hoc logging using a mix of the imported logger functions and direct `console.*` calls. The model must:

1. **Replace `src/logger.ts`** with a structured Logger implementation:
   - `Logger` class with configurable log levels: `debug`, `info`, `warn`, `error`
   - Structured JSON output: `{ timestamp: string, level: string, service: string, message: string, data?: unknown }`
   - `createLogger(serviceName: string, options?: LoggerOptions): Logger` factory function
   - `LoggerOptions` type: `{ level?: LogLevel; output?: (entry: LogEntry) => void }`
   - `LogLevel` type: `"debug" | "info" | "warn" | "error"`
   - `LogEntry` type: `{ timestamp: string; level: LogLevel; service: string; message: string; data?: unknown }`
   - Level filtering: setting level to `"warn"` suppresses `debug` and `info` calls (only `warn` and `error` are emitted)
   - Default `output` function: `(entry) => console.log(JSON.stringify(entry))`
   - Default `level`: `"debug"` (all levels emitted)

2. **Refactor all three service files** to use the structured logger:
   - `src/user-service.ts` -- 3 console calls to replace
   - `src/order-service.ts` -- 4 console calls to replace
   - `src/payment-service.ts` -- 5 console calls to replace
   - Each service must create its own logger instance via `createLogger("service-name")`
   - Replace every `console.log` with `logger.info` (or `logger.debug` where appropriate)
   - Replace every `console.warn` with `logger.warn`
   - Replace every `console.error` with `logger.error`
   - Log call sites should include structured context data (e.g., `logger.info("User created", { userId: id, name })`)

3. **Preserve all existing service functionality** -- services must behave identically except for log output format. No changes to function signatures, return types, or business logic.

**Important**: The service files use mixed logging patterns. Some calls use the imported `log`/`error`/`warn` from the naive logger, and some use `console.log`/`console.error`/`console.warn` directly. The model must catch and replace ALL patterns across all files. No `console.log`, `console.warn`, or `console.error` calls should remain in any service file after refactoring.

## Setup Instructions

1. Copy `setup/` contents into the worktree root
2. The `src/logger.ts` file contains the naive logger to be replaced
3. The `src/user-service.ts`, `src/order-service.ts`, and `src/payment-service.ts` files contain working services with ad-hoc console logging
4. The `tsconfig.json` file provides TypeScript compiler configuration

## Requirements Checklist

### Correctness

- [ ] `createLogger("user-service")` returns a Logger instance with service name embedded in all log entries
- [ ] `logger.info("message")` outputs valid JSON with `timestamp`, `level`, `service`, `message` fields
- [ ] `logger.info("message", { key: "value" })` includes `data` field in the JSON output
- [ ] Level filtering works: `createLogger("svc", { level: "warn" })` suppresses `debug` and `info` calls
- [ ] Level filtering works: `createLogger("svc", { level: "error" })` suppresses `debug`, `info`, and `warn` calls
- [ ] All `console.log` calls in service files replaced with appropriate `logger.info` or `logger.debug` calls
- [ ] All `console.warn` calls in service files replaced with `logger.warn`
- [ ] All `console.error` calls in service files replaced with `logger.error`
- [ ] No `console.log`, `console.warn`, or `console.error` calls remain in any service file

### Code Quality

- [ ] `Logger` class uses proper TypeScript types (`LogLevel`, `LogEntry`, `LoggerOptions`) -- no `any`
- [ ] Injectable `output` function in `LoggerOptions` enables testing without console capture
- [ ] Each service creates its own logger instance via `createLogger` (not a shared global)
- [ ] Logger module has no dependencies on service modules (no circular imports)
- [ ] Log call sites include meaningful context data (e.g., `logger.info("User created", { userId, name })`)

### Completeness

- [ ] `src/logger.ts` fully replaced with structured implementation (naive code removed)
- [ ] `src/user-service.ts` updated -- all 3 console calls replaced
- [ ] `src/order-service.ts` updated -- all 4 console calls replaced
- [ ] `src/payment-service.ts` updated -- all 5 console calls replaced
- [ ] Type definitions for `LogLevel`, `LogEntry`, `LoggerOptions` exported from `logger.ts`
- [ ] Factory function `createLogger` exported from `logger.ts`

### Error Handling

- [ ] Logger constructor handles missing options gracefully (defaults apply for both `level` and `output`)
- [ ] `output` function errors do not crash the service (logger swallows output errors)
- [ ] Service error paths still log errors with appropriate level (`error`) and context data
- [ ] Invalid log level in options defaults to `"debug"` or throws a clear, descriptive error

## Scoring Guide

| Dimension      | 1-3 (Failing)                                                                                          | 4-6 (Partial)                                                                                             | 7-8 (Good)                                                                                                  | 9-10 (Excellent)                                                                                                  |
|----------------|--------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| Correctness    | Logger class missing or non-functional; fewer than 4 of 12 console calls replaced across services      | Logger outputs JSON but level filtering broken; 5-8 of 12 console calls replaced; some direct console calls remain | Logger works with level filtering; 9-11 of 12 console calls replaced; at most 1 direct console call remains | All 12 console calls replaced; level filtering correct for all 4 levels; JSON output valid with all required fields |
| Code Quality   | `any` types used; logger and services tightly coupled; no TypeScript types for LogLevel/LogEntry        | Types defined but incomplete; `output` not injectable; services share a single global logger instance      | Proper types; injectable output; per-service logger instances; minor issues like missing context data in logs | Full type safety; injectable output; per-service instances; all log sites include structured context data           |
| Completeness   | Logger partially implemented; 1 or fewer service files updated                                         | Logger complete but 1-2 service files not updated; or types not exported                                  | All 4 files updated; types exported; 1-2 minor items missing (e.g., one type not exported)                  | All 4 files fully updated; all types exported; `createLogger` factory exported; no items missing                    |
| Error Handling | No default options handling; output errors crash services; invalid log level causes runtime exception   | Default options partially handled; output errors not caught; invalid level not addressed                   | Defaults apply for missing options; output errors caught; invalid level handled but edge cases remain        | All defaults applied gracefully; output errors swallowed silently; invalid level defaults or throws descriptive error |
