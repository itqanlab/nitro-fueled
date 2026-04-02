# Investigation Plan — TASK_2026_174

## Approach

1. Collect the retrospective summary and provider-statements that define the reliability problem.
2. Inspect session logs and worker logs for each GLM-5-related fallback, kill, or zero-activity event.
3. Group the events into a failure taxonomy with counts and supporting evidence.
4. Compare failed tasks against task metadata to test whether task type or complexity explains the failures.
5. Translate the evidence into concrete recommendations for:
   - GLM-5 health-check timing
   - routing restrictions
   - prompt adjustments
6. Document follow-on tasks needed to implement the recommendations.

## Success Criteria

- Every acceptance-criteria question is answered with cited evidence.
- Failure counts reconcile with the retrospective summary: 9 total fallbacks, 8 GLM-5-related, 1 outlier.
- Recommendations are specific enough to implement without reopening the investigation.
