import React from 'react';
import { useDashboardStore } from '../store/index.js';
import { tokens } from '../theme/tokens.js';

export function Roadmap(): React.JSX.Element {
  const plan = useDashboardStore((s) => s.plan);
  const isLoading = useDashboardStore((s) => s.isLoading);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;
  }

  if (!plan) {
    return (
      <div
        style={{
          color: tokens.colors.textDim,
          textAlign: 'center',
          padding: '40px',
        }}
      >
        No plan available
      </div>
    );
  }

  const activePhase = plan.currentFocus?.activePhase;

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
        Roadmap
      </h1>

      {plan.overview && (
        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: tokens.colors.textBright,
              marginBottom: '12px',
            }}
          >
            Overview
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: tokens.colors.text,
              lineHeight: 1.6,
            }}
          >
            {plan.overview}
          </p>
        </div>
      )}

      {plan.currentFocus && (
        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.accent}`,
            borderRadius: tokens.radius.md,
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: tokens.colors.accent,
              marginBottom: '16px',
            }}
          >
            Current Focus
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '4px' }}>
                Active Phase
              </div>
              <div style={{ fontSize: '14px', color: tokens.colors.textBright, fontWeight: 600 }}>
                {plan.currentFocus.activePhase}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '4px' }}>
                Active Milestone
              </div>
              <div style={{ fontSize: '14px', color: tokens.colors.textBright, fontWeight: 600 }}>
                {plan.currentFocus.activeMilestone}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '4px' }}>
                Next Priorities
              </div>
              <div style={{ fontSize: '14px', color: tokens.colors.textBright, fontWeight: 600 }}>
                {plan.currentFocus.nextPriorities.join(', ')}
              </div>
            </div>
          </div>
          {plan.currentFocus.supervisorGuidance && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '4px' }}>
                Guidance
              </div>
              <div style={{ fontSize: '13px', color: tokens.colors.text, lineHeight: 1.5 }}>
                {plan.currentFocus.supervisorGuidance}
              </div>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gap: '16px',
        }}
      >
        {plan.phases.map((phase) => {
          const isActive = phase.name === activePhase;
          const completedTasks = phase.taskMap.filter((t) => t.status === 'COMPLETE').length;
          const progress = phase.taskMap.length > 0 ? completedTasks / phase.taskMap.length : 0;

          return (
            <div
              key={phase.name}
              style={{
                backgroundColor: tokens.colors.bgCard,
                border: `1px solid ${isActive ? tokens.colors.accent : tokens.colors.border}`,
                borderRadius: tokens.radius.md,
                padding: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: isActive ? tokens.colors.accent : tokens.colors.textBright,
                      margin: 0,
                    }}
                  >
                    {phase.name}
                  </h3>
                  <div style={{ fontSize: '13px', color: tokens.colors.textDim, marginTop: '4px' }}>
                    {phase.description}
                  </div>
                </div>
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isActive
                      ? tokens.colors.accentGlow
                      : 'rgba(148,163,184,0.1)',
                    color: isActive ? tokens.colors.accent : tokens.colors.textDim,
                  }}
                >
                  {phase.status}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '16px',
                }}
              >
                {phase.milestones.map((milestone) => (
                  <div
                    key={milestone}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      backgroundColor: 'rgba(148,163,184,0.1)',
                      color: tokens.colors.textDim,
                    }}
                  >
                    {milestone}
                  </div>
                ))}
              </div>

              <div
                style={{
                  height: '6px',
                  backgroundColor: 'rgba(148,163,184,0.2)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress * 100}%`,
                    backgroundColor: isActive ? tokens.colors.accent : tokens.colors.green,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: tokens.colors.textDim,
                }}
              >
                {completedTasks} / {phase.taskMap.length} tasks completed
              </div>
            </div>
          );
        })}
      </div>

      {plan.decisions.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: tokens.colors.textBright,
              marginBottom: '16px',
            }}
          >
            Decisions Log
          </h2>
          <div
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.md,
              overflow: 'hidden',
            }}
          >
            {plan.decisions.map((decision, idx) => (
              <div
                key={idx}
                style={{
                  padding: '16px',
                  borderBottom:
                    idx < plan.decisions.length - 1
                      ? `1px solid ${tokens.colors.border}`
                      : undefined,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: tokens.colors.textBright,
                    }}
                  >
                    {decision.decision}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: tokens.colors.textDim,
                      fontFamily: tokens.font.mono,
                    }}
                  >
                    {decision.date}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: tokens.colors.text,
                    lineHeight: 1.5,
                  }}
                >
                  {decision.rationale}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
