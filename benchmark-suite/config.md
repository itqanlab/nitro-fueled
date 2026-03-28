# Benchmark Suite Configuration

## Task Manifest

| Task ID                           | Difficulty | Type        | Est. Time |
|-----------------------------------|------------|-------------|-----------|
| easy-01-single-file-bugfix        | easy       | bugfix      | 5m        |
| easy-02-add-utility-function      | easy       | feature     | 8m        |
| medium-01-multi-file-feature      | medium     | feature     | 20m       |
| medium-02-refactor-extract-module | medium     | refactoring | 15m       |
| hard-01-cross-cutting-change      | hard       | feature     | 30m       |

## Difficulty Weights

Weights for aggregate scoring. Hard tasks count more because they test deeper competencies (cross-file coordination, architecture decisions).

| Difficulty | Weight                        |
|------------|-------------------------------|
| easy       | 1.0                           |
| medium     | 1.5                           |
| hard       | 2.0                           |
| custom     | Read from task.md Metadata    |

## Scoring Dimensions

Every benchmark task is scored on these four standard dimensions. Scores range from 1 to 10 per dimension.

| Dimension      | Description                                                        |
|----------------|--------------------------------------------------------------------|
| Correctness    | Functional accuracy against the specification and all edge cases   |
| Code Quality   | TypeScript best practices, proper typing, readability, minimal changes |
| Completeness   | All requirements addressed, nothing missing, all files in place    |
| Error Handling | Invalid inputs, edge cases, and failure modes handled gracefully   |

## Extending with Project-Specific Tasks

### Convention

- Place custom tasks in: `benchmark-suite/tasks/custom-{NN}-{slug}/`
- Custom tasks follow the same `task.md` format as generic tasks (Metadata, Description, Setup Instructions, Requirements Checklist, Scoring Guide)
- Custom tasks appear in the Task Manifest table after generic tasks
- Custom tasks can define additional scoring dimensions beyond the standard four (appended to the Requirements Checklist and Scoring Guide, not replacing the standard dimensions)

### Adding a Custom Task

1. Create the task directory: `benchmark-suite/tasks/custom-01-your-task/`
2. Create `task.md` inside the directory following the standard task.md template (see any generic task for the exact structure)
3. Add a `setup/` directory with any seed files the task requires (may be empty if no setup is needed)
4. Add the task to the Task Manifest table in this file with the appropriate difficulty, type, and estimated time

### Custom Task Difficulty

Custom tasks specify their difficulty in the `task.md` Metadata table rather than inferring it from the directory prefix. This allows a `custom-01-my-task` to be rated as `hard` if the content warrants it.

## How the Evaluation Supervisor Loads Tasks

The Evaluation Supervisor discovers and loads benchmark tasks at runtime using the following process:

1. **Directory scanning**: The supervisor scans all subdirectories of `benchmark-suite/tasks/`. Each subdirectory that contains a `task.md` file is treated as a benchmark task.

2. **Prefix-based identification**: The supervisor identifies task type by the directory name prefix:
   - `easy-` -- generic easy-tier task, difficulty weight 1.0
   - `medium-` -- generic medium-tier task, difficulty weight 1.5
   - `hard-` -- generic hard-tier task, difficulty weight 2.0
   - `custom-` -- project-specific task, difficulty read from the task.md Metadata table

3. **Custom task difficulty**: For directories prefixed with `custom-`, the supervisor reads the Metadata table inside `task.md` to determine the difficulty level and corresponding weight. This allows custom tasks to be any difficulty tier regardless of prefix.

4. **Separate reporting**: Generic task scores are aggregated into the overall benchmark score using difficulty weights. Custom task results are reported in a separate "Custom Dimensions" section so they do not affect the generic task aggregate. This keeps the generic benchmark stable and comparable across projects while still allowing project-specific evaluation.
