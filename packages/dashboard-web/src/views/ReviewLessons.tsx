import React from 'react';
import { useEffect, useState } from 'react';
import { tokens } from '../theme/tokens.js';
import { api } from '../api/client.js';
import type { LessonEntry } from '../types/index.js';

export function ReviewLessons(): React.JSX.Element {
  const [lessons, setLessons] = useState<readonly LessonEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLessons = async (): Promise<void> => {
      try {
        const data = await api.getLessons();
        setLessons(data);
      } catch (error) {
        console.error('Failed to load review lessons:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadLessons();
  }, []);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;
  }

  if (lessons.length === 0) {
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
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
        <div
          style={{
            fontSize: '16px',
            color: tokens.colors.textDim,
          }}
        >
          No review lessons yet
        </div>
      </div>
    );
  }

  const groupedByDomain = lessons.reduce<Map<string, LessonEntry[]>>((acc, lesson) => {
    if (!acc.has(lesson.domain)) {
      acc.set(lesson.domain, []);
    }
    acc.get(lesson.domain)!.push(lesson);
    return acc;
  }, new Map());

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
        Review Lessons
      </h1>

      <div
        style={{
          display: 'grid',
          gap: '24px',
        }}
      >
        {Array.from(groupedByDomain.entries()).map(([domain, domainLessons]) => (
          <div key={domain}>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: tokens.colors.accent,
                marginBottom: '16px',
              }}
            >
              {domain}
            </h2>

            <div
              style={{
                display: 'grid',
                gap: '16px',
              }}
            >
              {domainLessons.map((entry, idx) => (
                <div
                  key={`${domain}-${idx}`}
                  style={{
                    backgroundColor: tokens.colors.bgCard,
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: tokens.radius.md,
                    padding: '20px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: tokens.colors.textBright,
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {entry.category}
                  </h3>

                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {entry.rules.map((rule, ruleIdx) => (
                      <li
                        key={ruleIdx}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: 'rgba(148,163,184,0.08)',
                          border: `1px solid ${tokens.colors.border}`,
                          borderRadius: tokens.radius.sm,
                          fontSize: '13px',
                          color: tokens.colors.text,
                          lineHeight: 1.5,
                        }}
                      >
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
