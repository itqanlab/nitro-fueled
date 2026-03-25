import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { tokens } from '../theme/tokens.js';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Task Board', icon: '📋' },
  { path: '/roadmap', label: 'Roadmap', icon: '🗺️' },
  { path: '/workers', label: 'Workers', icon: '⚙️' },
  { path: '/queue', label: 'Queue', icon: '📥' },
  { path: '/log', label: 'Session Log', icon: '📜' },
  { path: '/reviews', label: 'Reviews', icon: '🔍' },
  { path: '/cost', label: 'Cost', icon: '💰' },
  { path: '/patterns', label: 'Anti-Patterns', icon: '⚠️' },
  { path: '/lessons', label: 'Lessons', icon: '📚' },
];

export function Sidebar(): React.JSX.Element {
  const location = useLocation();

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: tokens.colors.bgCard,
        borderRight: `1px solid ${tokens.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: tokens.colors.accent,
          marginBottom: '32px',
          letterSpacing: '-0.5px',
        }}
      >
        Nitro-Fueled
      </div>
      <nav>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: tokens.radius.sm,
                    textDecoration: 'none',
                    color: isActive ? tokens.colors.textBright : tokens.colors.textDim,
                    backgroundColor: isActive ? tokens.colors.accentGlow : 'transparent',
                    fontWeight: 600,
                    fontSize: '14px',
                    transition: 'all 0.15s ease',
                    border: isActive
                      ? `1px solid ${tokens.colors.accent}`
                      : '1px solid transparent',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
