import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { tokens } from '../theme/tokens.js';
import type { WorkerTree, WorkerTreeNode, WorkerHealth } from '../types/index.js';

const HEALTH_COLOR: Record<WorkerHealth, string> = {
  healthy: tokens.colors.green,
  warning: tokens.colors.yellow,
  stuck: tokens.colors.red,
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function WorkerNode({ node, depth }: { readonly node: WorkerTreeNode; readonly depth: number }): React.JSX.Element {
  const healthColor = HEALTH_COLOR[node.health];

  return (
    <div style={{ marginLeft: depth > 0 ? '24px' : '0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          backgroundColor: depth === 0 ? tokens.colors.bgCard : tokens.colors.bg,
          border: `1px solid ${depth === 0 ? tokens.colors.borderAccent : tokens.colors.border}`,
          borderRadius: tokens.radius.sm,
          marginBottom: '6px',
        }}
      >
        <span
          title={node.health}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: healthColor,
            flexShrink: 0,
            boxShadow: node.health === 'stuck' ? `0 0 6px ${healthColor}` : 'none',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: tokens.colors.textBright, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.role}
          </div>
          <div style={{ fontSize: '11px', color: tokens.colors.textDim, marginTop: '2px' }}>
            {node.workerType} · {node.status}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '12px', color: tokens.colors.text }}>{formatElapsed(node.elapsedMs)}</div>
          {node.stuckCount > 0 && (
            <div style={{ fontSize: '11px', color: tokens.colors.yellow }}>stuck ×{node.stuckCount}</div>
          )}
        </div>
      </div>
      {node.children.map((child) => (
        <WorkerNode key={child.workerId} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function SquadCard({ tree }: { readonly tree: WorkerTree }): React.JSX.Element {
  return (
    <div
      style={{
        backgroundColor: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.borderAccent}`,
        borderRadius: tokens.radius.md,
        padding: '20px',
        marginBottom: '20px',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.accent, marginBottom: '16px', fontFamily: tokens.font.mono }}>
        {tree.taskId}
      </div>
      <div>
        {tree.roots.map((root) => (
          <WorkerNode key={root.workerId} node={root} depth={0} />
        ))}
      </div>
    </div>
  );
}

export function Squad(): React.JSX.Element {
  const [trees, setTrees] = useState<readonly WorkerTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = (): void => {
    api.getWorkerTree()
      .then(setTrees)
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;

  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: tokens.colors.textBright, marginBottom: '8px' }}>
        Squad View
      </h1>
      <div style={{ fontSize: '13px', color: tokens.colors.textDim, marginBottom: '24px' }}>
        Active worker teams — refreshes every 5s
      </div>

      {fetchError !== null && (
        <div style={{ color: tokens.colors.red, marginBottom: '16px', fontSize: '13px' }}>{fetchError}</div>
      )}

      {trees.length === 0 ? (
        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '48px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <div style={{ fontSize: '16px', color: tokens.colors.textDim }}>No active squads</div>
        </div>
      ) : (
        <div>
          {trees.map((tree) => (
            <SquadCard key={tree.taskId} tree={tree} />
          ))}
        </div>
      )}
    </div>
  );
}
