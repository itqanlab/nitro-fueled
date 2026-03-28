import React, { useEffect, useRef } from 'react';
import { useSessionData } from '../hooks/index.js';
import { tokens } from '../theme/tokens.js';

function formatTimestamp(raw: string): string {
  const date = new Date(raw);
  if (isNaN(date.getTime())) return raw;
  return date.toLocaleTimeString();
}

export function SessionLog(): React.JSX.Element {
  const sessionData = useSessionData();
  const logRef = useRef<HTMLDivElement>(null);

  const entries = sessionData?.log ?? [];

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries]);

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
        Session Log
      </h1>

      <div
        ref={logRef}
        style={{
          backgroundColor: tokens.colors.bgCard,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.md,
          padding: '16px',
          height: 'calc(100vh - 140px)',
          overflowY: 'auto',
          fontFamily: tokens.font.mono,
          fontSize: '13px',
        }}
      >
        {entries.length === 0 ? (
          <div
            style={{
              color: tokens.colors.textDim,
              textAlign: 'center',
              padding: '40px',
            }}
          >
            No log entries yet
          </div>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '6px 0',
                borderBottom:
                  idx < entries.length - 1
                    ? `1px solid ${tokens.colors.border}`
                    : undefined,
              }}
            >
              <div
                style={{
                  color: tokens.colors.textDim,
                  fontSize: '11px',
                  minWidth: '80px',
                  flexShrink: 0,
                }}
              >
                {formatTimestamp(entry.timestamp)}
              </div>
              <div
                style={{
                  color: tokens.colors.textDim,
                  fontSize: '11px',
                  minWidth: '100px',
                  flexShrink: 0,
                }}
              >
                {entry.source}
              </div>
              <div
                style={{
                  color: tokens.colors.text,
                  wordBreak: 'break-word',
                }}
              >
                {entry.event}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
