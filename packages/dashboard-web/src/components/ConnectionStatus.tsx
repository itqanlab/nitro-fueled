import React, { useEffect, useState } from 'react';
import { ws } from '../api/socket.js';
import { tokens } from '../theme/tokens.js';

export function ConnectionStatus(): React.JSX.Element {
  const [state, setState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  useEffect(() => {
    const unsubscribe = ws.onStateChange((newState) => setState(newState));
    return unsubscribe;
  }, []);

  const isHealthy = state === 'connected';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        backgroundColor: tokens.colors.bgCard,
        borderBottom: `1px solid ${tokens.colors.border}`,
        fontSize: '13px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: tokens.colors.textDim,
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isHealthy ? tokens.colors.green : tokens.colors.red,
            animation: isHealthy ? 'pulse 2s infinite' : undefined,
          }}
        />
        {state === 'connected' && 'Connected'}
        {state === 'connecting' && 'Connecting...'}
        {state === 'disconnected' && 'Disconnected'}
        {state === 'error' && 'Connection Error'}
      </div>
      <div style={{ color: tokens.colors.textDim }}>
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
