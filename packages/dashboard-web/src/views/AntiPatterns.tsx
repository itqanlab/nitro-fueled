import React from 'react';
import { useEffect, useState } from 'react';
import { tokens } from '../theme/tokens.js';
import { api } from '../api/client.js';
import type { AntiPatternRule } from '../types/index.js';

export function AntiPatterns(): React.JSX.Element {
  const [patterns, setPatterns] = useState<readonly AntiPatternRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPatterns = async (): Promise<void> => {
      try {
        const data = await api.getAntiPatterns();
        setPatterns(data);
      } catch (error) {
        console.error('Failed to load anti-patterns:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPatterns();
  }, []);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;
  }

  if (patterns.length === 0) {
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
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <div
          style={{
            fontSize: '16px',
            color: tokens.colors.textDim,
          }}
        >
          No anti-patterns loaded
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
        Anti-Patterns
      </h1>

      <div
        style={{
          display: 'grid',
          gap: '16px',
        }}
      >
        {patterns.map((category, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.md,
              padding: '20px',
            }}
          >
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: tokens.colors.textBright,
                marginBottom: '16px',
              }}
            >
              {category.category}
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
              {category.rules.map((rule, ruleIdx) => (
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
  );
}
