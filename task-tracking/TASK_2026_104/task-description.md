# Task Description — TASK_2026_104

## Overview

Enhance the RESEARCH orchestration flow to support four structured sub-flows: market research, competitive analysis, technology evaluation, and feasibility study. Update all related reference files.

## Requirements

### 1. strategies.md — Expand RESEARCH section

- Replace the minimal RESEARCH section with a full, expanded description
- Add a Sub-Flow table with 4 sub-flow types and their pipeline
- Add ASCII flow diagrams for each sub-flow (or combined diagram with branching)
- Add new keyword triggers: "market research", "competitive analysis", "feasibility study", "technology evaluation", "benchmark", "comparison", "evaluate options"
- Add review criteria for RESEARCH outputs: source quality, depth, actionable recommendations, bias detection
- Update Strategy Overview table to reflect new complexity description

### 2. SKILL.md — Update RESEARCH routing

- Update the RESEARCH entry in the Quick Start Strategy Quick Reference table
- Update RESEARCH keyword list in the Workflow Selection Matrix
- Add sub-flow detection guidance

### 3. agent-catalog.md — Update Researcher + PM + Architect

- `nitro-researcher-expert`: Add RESEARCH strategy sub-flows to Triggers section
- `nitro-project-manager`: Add RESEARCH sub-flow scoping to Triggers section
- `nitro-software-architect`: Add technology evaluation + feasibility roles to Triggers section
- Update Agent Selection Matrix with RESEARCH row showing full sub-flow pipeline

### 4. checkpoints.md — Update RESEARCH row

- Update the Checkpoint Applicability by Strategy table for RESEARCH
- RESEARCH now uses: Scope (Yes — for sub-flow selection), Blocker (Yes), Completion (Yes)
- No Architecture or QA checkpoints (research produces reports, not code)

## Acceptance Criteria

- [ ] strategies.md RESEARCH section has 4 sub-flow diagrams
- [ ] New RESEARCH keywords documented in both strategies.md and SKILL.md
- [ ] checkpoints.md RESEARCH row updated (Scope=Yes)
- [ ] agent-catalog.md updated for Researcher + PM + Architect in research sub-flows
- [ ] All changes are internally consistent across the 4 files
