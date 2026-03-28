import React, { useEffect, useState } from 'react';
import { useDashboardStore } from '../store/index.js';
import { api } from '../api/client.js';
import { tokens } from '../theme/tokens.js';
import type { PipelineData, PipelinePhase, PipelinePhaseStatus } from '../types/index.js';

const PULSE_STYLE = `
@keyframes pipelinePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(249,115,22,0); }
}
`;

const STATUS_COLOR: Record<PipelinePhaseStatus, string> = {
  complete: tokens.colors.green,
  active: tokens.colors.accent,
  failed: tokens.colors.red,
  pending: tokens.colors.textDim,
};

const STATUS_BG: Record<PipelinePhaseStatus, string> = {
  complete: tokens.colors.greenDim,
  active: tokens.colors.accentGlow,
  failed: tokens.colors.redDim,
  pending: tokens.colors.bgCard,
};

function PhaseNode({ phase }: { readonly phase: PipelinePhase }): React.JSX.Element {
  const color = STATUS_COLOR[phase.status];
  const bg = STATUS_BG[phase.status];
  const isActive = phase.status === 'active';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        minWidth: phase.isParallel ? '160px' : '120px',
      }}
    >
      <div
        style={{
          backgroundColor: bg,
          border: `2px solid ${color}`,
          borderRadius: tokens.radius.md,
          padding: '12px 16px',
          textAlign: 'center',
          width: '100%',
          animation: isActive ? 'pipelinePulse 1.5s ease-in-out infinite' : 'none',
        }}
      >
        <div style={{ fontSize: '11px', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
          {phase.status === 'complete' ? '✓' : phase.status === 'failed' ? '✗' : phase.status === 'active' ? '●' : '○'} {phase.status}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textBright }}>
          {phase.name}
        </div>
        {phase.isParallel && phase.parallelParts.length > 0 && (
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {phase.parallelParts.map((part) => (
              <div key={part} style={{ fontSize: '11px', color: tokens.colors.textDim, backgroundColor: tokens.colors.bg, borderRadius: '4px', padding: '2px 6px' }}>
                {part}
              </div>
            ))}
          </div>
        )}
      </div>
      {phase.duration !== null && (
        <div style={{ fontSize: '11px', color: tokens.colors.textDim }}>{phase.duration}</div>
      )}
    </div>
  );
}

function PipelineArrow(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', color: tokens.colors.borderAccent, fontSize: '20px', paddingBottom: '20px' }}>
      →
    </div>
  );
}

export function Pipeline(): React.JSX.Element {
  const registry = useDashboardStore((s) => s.registry);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const [selectedId, setSelectedId] = useState<string>('');
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const activeTasks = registry.filter((t) => t.status !== 'CANCELLED');

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setFetchError(null);
    api.getTaskPipeline(selectedId)
      .then((data) => {
        if (!controller.signal.aborted) setPipeline(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setFetchError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => controller.abort();
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId && activeTasks.length > 0) {
      setSelectedId(activeTasks[0].id);
    }
  }, [activeTasks, selectedId]);

  if (isLoading) return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;

  return (
    <>
      <style>{PULSE_STYLE}</style>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: tokens.colors.textBright, marginBottom: '24px' }}>
          Pipeline View
        </h1>

        <div style={{ marginBottom: '24px' }}>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.sm,
              color: tokens.colors.text,
              padding: '8px 12px',
              fontSize: '13px',
              minWidth: '280px',
            }}
          >
            <option value="">Select a task...</option>
            {activeTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.id} — {t.description.slice(0, 50)}</option>
            ))}
          </select>
        </div>

        {fetchError !== null && (
          <div style={{ color: tokens.colors.red, marginBottom: '16px', fontSize: '13px' }}>{fetchError}</div>
        )}

        {pipeline !== null && (
          <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', overflowX: 'auto' }}>
              {pipeline.phases.map((phase, i) => (
                <React.Fragment key={phase.name}>
                  {i > 0 && <PipelineArrow />}
                  <PhaseNode phase={phase} />
                </React.Fragment>
              ))}
            </div>
            {pipeline.totalDuration !== null && (
              <div style={{ marginTop: '24px', fontSize: '13px', color: tokens.colors.textDim }}>
                Total duration: <span style={{ color: tokens.colors.textBright, fontWeight: 600 }}>{pipeline.totalDuration}</span>
                {pipeline.outcome !== null && (
                  <span style={{ marginLeft: '16px' }}>
                    Outcome: <span style={{ color: pipeline.outcome === 'COMPLETE' ? tokens.colors.green : tokens.colors.red, fontWeight: 600 }}>{pipeline.outcome}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
