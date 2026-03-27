import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../theme/tokens.js';
import { api } from '../api/client.js';
import { useDashboardStore } from '../store/index.js';
import type { GraphData, GraphEdge, TaskStatus } from '../types/index.js';
import { computeLayout, computeCriticalPath, computeChain, NODE_W, NODE_H } from '../components/graphLayout.js';
import { GraphSvg, GraphTooltip, statusColor, statusDim } from '../components/GraphSvg.js';

const STATUS_OPTIONS: TaskStatus[] = [
  'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW',
  'FIXING', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
];
const TYPE_OPTIONS = ['FEATURE', 'BUGFIX', 'REFACTORING', 'DOCUMENTATION', 'RESEARCH', 'DEVOPS', 'CREATIVE'];

export function DependencyGraph(): React.JSX.Element {
  const navigate = useNavigate();
  const lastUpdated = useDashboardStore((s) => s.lastUpdated);

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [hiddenStatuses, setHiddenStatuses] = useState<Set<TaskStatus>>(new Set());
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [hideComplete, setHideComplete] = useState(false);
  const [pan, setPan] = useState({ x: 32, y: 32 });
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const fetchAbort = useRef<AbortController | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const fetchGraph = useCallback(async () => {
    fetchAbort.current?.abort();
    const controller = new AbortController();
    fetchAbort.current = controller;
    try {
      const data = await api.getGraph(controller.signal);
      setGraphData(data);
      setError(null);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchGraph(); }, [fetchGraph, lastUpdated]);

  const { layoutNodes, filteredEdges, criticalPath, highlightSet } = useMemo(() => {
    if (!graphData) return { layoutNodes: [], filteredEdges: [] as ReadonlyArray<GraphEdge>, criticalPath: new Set<string>(), highlightSet: new Set<string>() };

    const filteredNodes = graphData.nodes.filter((n) => {
      if (hideComplete && n.status === 'COMPLETE') return false;
      if (hiddenStatuses.has(n.status as TaskStatus)) return false;
      if (hiddenTypes.has(n.type)) return false;
      return true;
    });
    const nodeIdSet = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = graphData.edges.filter((e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to));
    const layoutNodes = computeLayout(filteredNodes, filteredEdges);
    const criticalPath = computeCriticalPath(filteredNodes, filteredEdges);
    const highlightSet = selectedId ? computeChain(selectedId, filteredEdges) : new Set<string>();
    return { layoutNodes, filteredEdges, criticalPath, highlightSet };
  }, [graphData, hiddenStatuses, hiddenTypes, hideComplete, selectedId]);

  const fitToView = useCallback(() => {
    if (layoutNodes.length === 0 || !svgContainerRef.current) return;
    const { clientWidth: w, clientHeight: h } = svgContainerRef.current;
    let maxX = 0;
    let maxY = 0;
    for (const n of layoutNodes) {
      if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
      if (n.y + NODE_H > maxY) maxY = n.y + NODE_H;
    }
    setScale(Math.min((w - 64) / maxX, (h - 64) / maxY, 1.5));
    setPan({ x: 32, y: 32 });
  }, [layoutNodes]);

  useEffect(() => { if (layoutNodes.length > 0) fitToView(); }, [fitToView, layoutNodes.length]);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    const tag = (e.target as Element).tagName;
    if (tag === 'rect' || tag === 'text' || tag === 'circle') return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    };
    const onUp = () => { isPanning.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => Math.max(0.2, Math.min(3, s * (e.deltaY < 0 ? 1.1 : 0.9))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleNodeClick = useCallback((id: string) => {
    if (selectedId === id) navigate(`/task/${id}`);
    else setSelectedId(id);
  }, [selectedId, navigate]);

  const toggleStatus = (s: TaskStatus) =>
    setHiddenStatuses((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  const toggleType = (t: string) =>
    setHiddenTypes((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n; });

  const svgContainerRect = svgContainerRef.current?.getBoundingClientRect();
  const svgOffset = svgContainerRect ? { x: svgContainerRect.left, y: svgContainerRect.top } : { x: 0, y: 0 };
  const hoveredNode = layoutNodes.find((n) => n.id === hoveredId) ?? null;

  if (loading) {
    return <div style={{ color: tokens.colors.textDim, padding: '48px' }}>Loading dependency graph...</div>;
  }

  if (error) {
    return (
      <div style={{ color: tokens.colors.red, padding: '48px' }}>
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>Failed to load graph</div>
        <div style={{ fontSize: '13px', color: tokens.colors.textDim }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <Header
        nodeCount={layoutNodes.length}
        edgeCount={filteredEdges.length}
        hasSelection={!!selectedId}
        onFit={fitToView}
        onClearSelection={() => setSelectedId(null)}
      />

      <FilterBar
        hiddenStatuses={hiddenStatuses}
        hiddenTypes={hiddenTypes}
        hideComplete={hideComplete}
        onToggleStatus={toggleStatus}
        onToggleType={toggleType}
        onToggleHideComplete={setHideComplete}
      />

      <Legend />

      <div
        style={{
          flex: 1,
          backgroundColor: tokens.colors.bgCard,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.md,
          overflow: 'hidden',
          display: 'flex',
          minHeight: 0,
        }}
        onClick={(e) => {
          // Nodes call stopPropagation, so any click reaching here is SVG background
          if ((e.target as Element).tagName === 'svg') setSelectedId(null);
        }}
      >
        {layoutNodes.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: tokens.colors.textDim, gap: '12px' }}>
            <div style={{ fontSize: '48px' }}>🕸️</div>
            <div>No tasks match the current filters</div>
          </div>
        ) : (
          <GraphSvg
            layoutNodes={layoutNodes}
            edges={filteredEdges}
            criticalPath={criticalPath}
            highlightSet={highlightSet}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onNodeClick={handleNodeClick}
            onNodeHover={setHoveredId}
            pan={pan}
            scale={scale}
            onPanStart={handlePanStart}
            svgRef={svgRef}
            svgContainerRef={svgContainerRef}
          />
        )}
      </div>

      {hoveredNode && (
        <GraphTooltip node={hoveredNode} svgOffset={svgOffset} scale={scale} pan={pan} />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface HeaderProps {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly hasSelection: boolean;
  readonly onFit: () => void;
  readonly onClearSelection: () => void;
}

function Header({ nodeCount, edgeCount, hasSelection, onFit, onClearSelection }: HeaderProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: tokens.colors.textBright, margin: 0 }}>
        Dependency Graph
      </h1>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: tokens.colors.textDim }}>
          {nodeCount} nodes · {edgeCount} edges
        </span>
        <BtnGhost onClick={onFit}>Fit View</BtnGhost>
        <BtnGhost
          onClick={onClearSelection}
          style={{
            backgroundColor: hasSelection ? tokens.colors.accentGlow : tokens.colors.bgCard,
            color: hasSelection ? tokens.colors.accent : tokens.colors.textDim,
            border: `1px solid ${hasSelection ? tokens.colors.accent : tokens.colors.border}`,
          }}
        >
          Clear Selection
        </BtnGhost>
      </div>
    </div>
  );
}

function BtnGhost({
  onClick,
  children,
  style,
}: {
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: tokens.radius.sm,
        border: `1px solid ${tokens.colors.border}`,
        backgroundColor: tokens.colors.bgCard,
        color: tokens.colors.text,
        cursor: 'pointer',
        fontSize: '13px',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

interface FilterBarProps {
  readonly hiddenStatuses: Set<TaskStatus>;
  readonly hiddenTypes: Set<string>;
  readonly hideComplete: boolean;
  readonly onToggleStatus: (s: TaskStatus) => void;
  readonly onToggleType: (t: string) => void;
  readonly onToggleHideComplete: (v: boolean) => void;
}

function FilterBar({ hiddenStatuses, hiddenTypes, hideComplete, onToggleStatus, onToggleType, onToggleHideComplete }: FilterBarProps): React.JSX.Element {
  return (
    <div
      style={{
        backgroundColor: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.md,
        padding: '12px 16px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        flexShrink: 0,
      }}
    >
      <div>
        <FilterLabel>Status</FilterLabel>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((s) => {
            const hidden = hiddenStatuses.has(s);
            return (
              <button
                key={s}
                onClick={() => onToggleStatus(s)}
                style={{
                  padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                  border: `1px solid ${hidden ? tokens.colors.border : statusColor(s)}`,
                  backgroundColor: hidden ? 'transparent' : statusDim(s),
                  color: hidden ? tokens.colors.textDim : statusColor(s),
                  opacity: hidden ? 0.5 : 1,
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FilterLabel>Type</FilterLabel>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {TYPE_OPTIONS.map((t) => {
            const hidden = hiddenTypes.has(t);
            const typeColor = tokens.typeColors[t as keyof typeof tokens.typeColors];
            return (
              <button
                key={t}
                onClick={() => onToggleType(t)}
                style={{
                  padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                  border: `1px solid ${hidden ? tokens.colors.border : typeColor?.bg ?? tokens.colors.border}`,
                  backgroundColor: hidden ? 'transparent' : typeColor?.dim ?? 'transparent',
                  color: hidden ? tokens.colors.textDim : typeColor?.bg ?? tokens.colors.text,
                  opacity: hidden ? 0.5 : 1,
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: tokens.colors.text, paddingTop: '18px' }}>
        <input type="checkbox" checked={hideComplete} onChange={(e) => onToggleHideComplete(e.target.checked)} style={{ accentColor: tokens.colors.accent }} />
        Hide COMPLETE
      </label>
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ fontSize: '11px', color: tokens.colors.textDim, marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {children}
    </div>
  );
}

function Legend(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: '20px', flexShrink: 0, flexWrap: 'wrap', fontSize: '12px', color: tokens.colors.textDim }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '24px', height: '2px', backgroundColor: tokens.colors.accent, display: 'inline-block' }} />
        Critical path
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '24px', height: '2px', backgroundColor: tokens.colors.cyan, display: 'inline-block' }} />
        Selected chain
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: tokens.colors.green, display: 'inline-block' }} />
        Unblocked (ready to start)
      </span>
      <span>Click node to select chain · Click again to open detail</span>
    </div>
  );
}
