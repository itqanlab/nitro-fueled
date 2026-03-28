import React from 'react';
import { tokens } from '../theme/tokens.js';
import { Sidebar } from './Sidebar.js';
import { ConnectionStatus } from './ConnectionStatus.js';

interface LayoutProps {
  readonly children: React.ReactNode;
}

export function Layout({ children }: LayoutProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: tokens.colors.bg,
        color: tokens.colors.text,
        fontFamily: tokens.font.sans,
      }}
    >
      <Sidebar />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ConnectionStatus />
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
