# TASK_2026_212 — Investigate GPT-5.4 PREP Phase Kill Pattern

## Metadata
| Field | Value |
|-------|-------|
| Title | GPT-5.4 Prep Worker Kill Rate — Root Cause Investigation |
| Type | RESEARCH |
| Priority | P2-Medium |
| Complexity | Simple |
| Status | CREATED |
| Dependencies | none |
| Created | 2026-03-30 |

## Description
In SESSION_2026-03-30T19-17-29, GPT-5.4 had 50% kill rate on PREP workers. Investigate JSONL logs for killed workers (PIDs 62333, 65311, 62488), determine root cause (model capability, provider/launcher issue, timeout), compare with other model PREP behavior, recommend routing changes. Cost impact: ~$4-5 wasted per session.

## File Scope
- none (research only)

## Parallelism
- Can run in parallel: Yes
- Conflicts with: none
- Wave: any
