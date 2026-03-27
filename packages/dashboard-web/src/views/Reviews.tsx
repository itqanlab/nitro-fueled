import React, { useEffect } from 'react';
import { useDashboardStore } from '../store/index.js';
import { tokens } from '../theme/tokens.js';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

// Load reviews for all statuses where review artifacts can exist.
const REVIEW_STATUSES = new Set([
  'IMPLEMENTED', 'IN_REVIEW', 'FIXING', 'COMPLETE', 'FAILED', 'BLOCKED',
]);

export function Reviews(): React.JSX.Element {
  const registry = useDashboardStore((s) => s.registry);
  const reviewsMap = useDashboardStore((s) => s.reviews);
  const setTaskReviews = useDashboardStore((s) => s.setTaskReviews);
  const isLoading = useDashboardStore((s) => s.isLoading);

  // Load reviews once per task-id that enters a reviewable status.
  // Uses the store as cache — only fetches tasks not already loaded.
  useEffect(() => {
    if (isLoading) return;
    const missing = registry.filter(
      (t) => REVIEW_STATUSES.has(t.status) && !reviewsMap.has(t.id),
    );
    for (const task of missing) {
      void api.getTaskReviews(task.id)
        .then((reviews) => {
          if (reviews.length > 0) setTaskReviews(task.id, reviews);
        })
        .catch(console.error);
    }
  }, [registry, isLoading, reviewsMap, setTaskReviews]);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;
  }

  const entries = Array.from(reviewsMap.entries()).filter(([id]) =>
    registry.some((t) => t.id === id),
  );

  if (entries.length === 0) {
    return (
      <div
        style={{
          backgroundColor: tokens.colors.bgCard,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.md,
          padding: '48px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
        <div style={{ fontSize: '16px', color: tokens.colors.textDim }}>
          No reviews yet
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: tokens.colors.textBright,
          marginBottom: '24px',
        }}
      >
        Reviews
      </h1>

      <div style={{ display: 'grid', gap: '16px' }}>
        {entries.map(([taskId, taskReviews]) => {
          const task = registry.find((t) => t.id === taskId);
          if (!task) return null;

          const totalCritical = taskReviews.reduce((sum, r) => sum + r.criticalIssues, 0);
          const totalSerious = taskReviews.reduce((sum, r) => sum + r.seriousIssues, 0);
          const totalModerate = taskReviews.reduce((sum, r) => sum + r.moderateIssues, 0);

          return (
            <Link key={taskId} to={`/task/${taskId}`} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  backgroundColor: tokens.colors.bgCard,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.md,
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.borderAccent;
                  e.currentTarget.style.backgroundColor = tokens.colors.bgCardHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.border;
                  e.currentTarget.style.backgroundColor = tokens.colors.bgCard;
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: tokens.colors.textBright,
                        marginBottom: '4px',
                      }}
                    >
                      {taskId}
                    </div>
                    <div style={{ fontSize: '13px', color: tokens.colors.textDim }}>
                      {task.description}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {taskReviews.map((review) => (
                    <div
                      key={`${taskId}-${review.reviewType}`}
                      style={{ display: 'flex', gap: '8px', fontSize: '12px' }}
                    >
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(6,182,212,0.15)',
                          color: tokens.colors.cyan,
                          fontWeight: 600,
                        }}
                      >
                        {review.reviewType}
                      </span>
                      {review.overallScore && (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(148,163,184,0.1)',
                            color: tokens.colors.textDim,
                          }}
                        >
                          {review.overallScore}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: `1px solid ${tokens.colors.border}`,
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: tokens.colors.redDim,
                        color: tokens.colors.red,
                        fontWeight: 600,
                      }}
                    >
                      {totalCritical}
                    </span>{' '}
                    critical
                  </div>
                  <div>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: tokens.colors.yellowDim,
                        color: tokens.colors.yellow,
                        fontWeight: 600,
                      }}
                    >
                      {totalSerious}
                    </span>{' '}
                    serious
                  </div>
                  <div>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: tokens.colors.purpleDim,
                        color: tokens.colors.purple,
                        fontWeight: 600,
                      }}
                    >
                      {totalModerate}
                    </span>{' '}
                    moderate
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
