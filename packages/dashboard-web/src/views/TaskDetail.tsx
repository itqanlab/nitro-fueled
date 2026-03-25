import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { tokens } from '../theme/tokens.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { api } from '../api/client.js';
import type { FullTaskData } from '../types/index.js';

export function TaskDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [taskData, setTaskData] = useState<FullTaskData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'definition' | 'reviews' | 'report'>('definition');

  useEffect(() => {
    if (!id) return;

    const loadTask = async (): Promise<void> => {
      try {
        const data = await api.getTask(id);
        setTaskData(data);
      } catch (error) {
        console.error('Failed to load task:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTask();
  }, [id]);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;
  }

  if (!taskData || (!taskData.definition && !taskData.registryRecord)) {
    return (
      <div
        style={{
          color: tokens.colors.textDim,
          textAlign: 'center',
          padding: '40px',
        }}
      >
        Task not found
      </div>
    );
  }

  const { definition, registryRecord, reviews, completionReport } = taskData;

  return (
    <div>
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          borderRadius: tokens.radius.sm,
          textDecoration: 'none',
          color: tokens.colors.textDim,
          fontSize: '13px',
          marginBottom: '20px',
          border: `1px solid ${tokens.colors.border}`,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = tokens.colors.borderAccent;
          e.currentTarget.style.color = tokens.colors.text;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = tokens.colors.border;
          e.currentTarget.style.color = tokens.colors.textDim;
        }}
      >
        ← Back to Board
      </Link>

      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: tokens.colors.textBright,
                marginBottom: '8px',
              }}
            >
              {id}
            </h1>
            {definition && (
              <div style={{ fontSize: '16px', color: tokens.colors.text }}>
                {definition.title}
              </div>
            )}
          </div>
          {registryRecord && (
            <StatusBadge status={registryRecord.status as any} />
          )}
        </div>

        {definition && (
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor:
                  tokens.typeColors[definition.type]?.dim ??
                  tokens.colors.blueDim,
                color: tokens.typeColors[definition.type]?.bg ?? tokens.colors.blue,
              }}
            >
              {definition.type}
            </span>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: 'rgba(148,163,184,0.1)',
                color: tokens.colors.textDim,
              }}
            >
              {definition.priority}
            </span>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: 'rgba(148,163,184,0.1)',
                color: tokens.colors.textDim,
              }}
            >
              {definition.complexity}
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          borderBottom: `1px solid ${tokens.colors.border}`,
        }}
      >
        {definition && (
          <button
            type="button"
            onClick={() => setActiveTab('definition')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'definition' ? tokens.colors.accent : 'transparent'}`,
              backgroundColor: 'transparent',
              color: activeTab === 'definition' ? tokens.colors.textBright : tokens.colors.textDim,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Definition
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'reviews' ? tokens.colors.accent : 'transparent'}`,
            backgroundColor: 'transparent',
            color: activeTab === 'reviews' ? tokens.colors.textBright : tokens.colors.textDim,
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reviews ({reviews.length})
        </button>
        {completionReport && (
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'report' ? tokens.colors.accent : 'transparent'}`,
              backgroundColor: 'transparent',
              color: activeTab === 'report' ? tokens.colors.textBright : tokens.colors.textDim,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Completion Report
          </button>
        )}
      </div>

      <div>
        {activeTab === 'definition' && definition && (
          <div
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.md,
              padding: '20px',
            }}
          >
            <section style={{ marginBottom: '24px' }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: tokens.colors.textBright,
                  marginBottom: '12px',
                }}
              >
                Description
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: tokens.colors.text,
                  lineHeight: 1.6,
                }}
              >
                {definition.description}
              </p>
            </section>

            {definition.dependencies.length > 0 && (
              <section style={{ marginBottom: '24px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: tokens.colors.textBright,
                    marginBottom: '12px',
                  }}
                >
                  Dependencies
                </h3>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {definition.dependencies.map((dep) => (
                    <Link
                      key={dep}
                      to={`/task/${dep}`}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        textDecoration: 'none',
                        backgroundColor: 'rgba(6,182,212,0.15)',
                        color: tokens.colors.cyan,
                      }}
                    >
                      {dep}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {definition.acceptanceCriteria.length > 0 && (
              <section>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: tokens.colors.textBright,
                    marginBottom: '12px',
                  }}
                >
                  Acceptance Criteria
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {definition.acceptanceCriteria.map((criteria, idx) => (
                    <li
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: 'rgba(34,197,94,0.1)',
                        border: `1px solid ${tokens.colors.green}`,
                        borderRadius: tokens.radius.sm,
                        fontSize: '13px',
                        color: tokens.colors.text,
                      }}
                    >
                      {criteria}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div
            style={{
              display: 'grid',
              gap: '16px',
            }}
          >
            {reviews.length === 0 ? (
              <div
                style={{
                  backgroundColor: tokens.colors.bgCard,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.md,
                  padding: '40px',
                  textAlign: 'center',
                  color: tokens.colors.textDim,
                }}
              >
                No reviews yet
              </div>
            ) : (
              reviews.map((review, idx) => (
                <div
                  key={`${review.reviewType}-${idx}`}
                  style={{
                    backgroundColor: tokens.colors.bgCard,
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: tokens.radius.md,
                    padding: '20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: tokens.colors.textBright,
                      }}
                    >
                      {review.reviewType} Review
                    </h3>
                    {review.overallScore && (
                      <span
                        style={{
                          padding: '6px 14px',
                          borderRadius: '999px',
                          fontSize: '14px',
                          fontWeight: 700,
                          backgroundColor: tokens.colors.accentGlow,
                          color: tokens.colors.accent,
                        }}
                      >
                        {review.overallScore}
                      </span>
                    )}
                  </div>

                  {review.assessment && (
                    <p
                      style={{
                        fontSize: '14px',
                        color: tokens.colors.text,
                        lineHeight: 1.6,
                        marginBottom: '16px',
                      }}
                    >
                      {review.assessment}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      marginBottom: '16px',
                      fontSize: '12px',
                      color: tokens.colors.textDim,
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
                        {review.criticalIssues}
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
                        {review.seriousIssues}
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
                        {review.moderateIssues}
                      </span>{' '}
                      moderate
                    </div>
                  </div>

                  {review.findings.length > 0 && (
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {review.findings.map((finding, findingIdx) => (
                        <li
                          key={findingIdx}
                          style={{
                            padding: '12px',
                            backgroundColor: 'rgba(148,163,184,0.08)',
                            border: `1px solid ${tokens.colors.border}`,
                            borderRadius: tokens.radius.sm,
                            fontSize: '13px',
                            color: tokens.colors.text,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: tokens.colors.textBright,
                              marginBottom: '6px',
                              fontSize: '12px',
                            }}
                          >
                            {finding.question}
                          </div>
                          <div style={{ lineHeight: 1.5 }}>
                            {finding.content}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'report' && completionReport && (
          <div
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.md,
              padding: '20px',
            }}
          >
            <section style={{ marginBottom: '24px' }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: tokens.colors.textBright,
                  marginBottom: '12px',
                }}
              >
                Files Changed
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {completionReport.filesCreated.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: tokens.colors.green,
                        marginBottom: '6px',
                        fontWeight: 600,
                      }}
                    >
                      Created ({completionReport.filesCreated.length})
                    </div>
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {completionReport.filesCreated.map((file, idx) => (
                        <li
                          key={idx}
                          style={{
                            fontFamily: tokens.font.mono,
                            fontSize: '12px',
                            color: tokens.colors.text,
                            padding: '4px 10px',
                            backgroundColor: 'rgba(34,197,94,0.1)',
                            borderRadius: '4px',
                          }}
                        >
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {completionReport.filesModified.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: tokens.colors.yellow,
                        marginBottom: '6px',
                        fontWeight: 600,
                      }}
                    >
                      Modified ({completionReport.filesModified.length})
                    </div>
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {completionReport.filesModified.map((file, idx) => (
                        <li
                          key={idx}
                          style={{
                            fontFamily: tokens.font.mono,
                            fontSize: '12px',
                            color: tokens.colors.text,
                            padding: '4px 10px',
                            backgroundColor: 'rgba(234,179,8,0.1)',
                            borderRadius: '4px',
                          }}
                        >
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {completionReport.reviewScores.length > 0 && (
              <section style={{ marginBottom: '24px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: tokens.colors.textBright,
                    marginBottom: '12px',
                  }}
                >
                  Review Scores
                </h3>
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  {completionReport.reviewScores.map((score, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: 'rgba(148,163,184,0.1)',
                        border: `1px solid ${tokens.colors.border}`,
                        borderRadius: tokens.radius.sm,
                        fontSize: '13px',
                        color: tokens.colors.text,
                      }}
                    >
                      <span style={{ fontWeight: 600, marginRight: '6px' }}>
                        {score.review}:
                      </span>
                      {score.score}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {completionReport.rootCause && (
              <section style={{ marginBottom: '24px' }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: tokens.colors.textBright,
                    marginBottom: '12px',
                  }}
                >
                  Root Cause
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: tokens.colors.text,
                    lineHeight: 1.6,
                    padding: '12px',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    border: `1px solid ${tokens.colors.red}`,
                    borderRadius: tokens.radius.sm,
                  }}
                >
                  {completionReport.rootCause}
                </p>
              </section>
            )}

            {completionReport.fix && (
              <section>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: tokens.colors.textBright,
                    marginBottom: '12px',
                  }}
                >
                  Fix Applied
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: tokens.colors.text,
                    lineHeight: 1.6,
                    padding: '12px',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    border: `1px solid ${tokens.colors.green}`,
                    borderRadius: tokens.radius.sm,
                  }}
                >
                  {completionReport.fix}
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
