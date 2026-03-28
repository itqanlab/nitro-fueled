import React, { useMemo } from 'react';
import { tokens } from '../theme/tokens.js';
import { NODE_W, NODE_H } from './graphLayout.js';
import type { LayoutNode } from './graphLayout.js';
import type { GraphEdge, TaskStatus } from '../types/index.js';

// ── Color helpers ─────────────────────────────────────────────────────────────

export function statusColor(status: TaskStatus): string {
  return tokens.stateColors[status]?.bg ?? tokens.colors.textDim;
}

export function statusDim(status: TaskStatus): string {
  return tokens.stateColors[status]?.dim ?? tokens.colors.bgCardHover;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipProps {
  readonly node: LayoutNode;
  readonly svgOffset: { x: number; y: number };
  readonly scale: number;
  readonly pan: { x: number; y: number };
}

export function GraphTooltip({ node, svgOffset, scale, pan }: TooltipProps): React.JSX.Element {
  const screenX = svgOffset.x + pan.x + node.x * scale + (NODE_W * scale) / 2;
  const screenY = svgOffset.y + pan.y + node.y * scale - 8;

  return (
    <div
      style={{
        position: 'fixed',
        left: screenX,
        top: screenY,
        transform: 'translate(-50%, -100%)',
        backgroundColor: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.borderAccent}`,
        borderRadius: tokens.radius.sm,
        padding: '10px 14px',
        fontSize: '12px',
        color: tokens.colors.text,
        pointerEvents: 'none',
        zIndex: 1000,
        minWidth: '180px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontWeight: 700, color: tokens.colors.textBright, marginBottom: '6px' }}>
        {node.id}
      </div>
      <div style={{ marginBottom: '4px', color: tokens.colors.textDim }}>{node.title}</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: statusDim(node.status),
            color: statusColor(node.status),
            fontWeight: 600,
            fontSize: '11px',
          }}
        >
          {node.status}
        </span>
        <span style={{ color: tokens.colors.textDim, fontSize: '11px' }}>{node.type}</span>
        <span style={{ color: tokens.colors.textDim, fontSize: '11px' }}>{node.priority}</span>
        {node.isUnblocked && node.status === 'CREATED' && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: tokens.colors.greenDim,
              color: tokens.colors.green,
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            READY
          </span>
        )}
      </div>
    </div>
  );
}

// ── Graph SVG ─────────────────────────────────────────────────────────────────

interface GraphSvgProps {
  readonly layoutNodes: LayoutNode[];
  readonly edges: ReadonlyArray<GraphEdge>;
  readonly criticalPath: Set<string>;
  readonly highlightSet: Set<string>;
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
  readonly onNodeClick: (id: string) => void;
  readonly onNodeHover: (id: string | null) => void;
  readonly pan: { x: number; y: number };
  readonly scale: number;
  readonly onPanStart: (e: React.MouseEvent) => void;
  readonly svgRef: React.RefObject<SVGSVGElement>;
  readonly svgContainerRef: React.RefObject<HTMLDivElement>;
}

export function GraphSvg({
  layoutNodes,
  edges,
  criticalPath,
  highlightSet,
  selectedId,
  hoveredId,
  onNodeClick,
  onNodeHover,
  pan,
  scale,
  onPanStart,
  svgRef,
  svgContainerRef,
}: GraphSvgProps): React.JSX.Element {
  const nodeMap = useMemo(() => new Map(layoutNodes.map((n) => [n.id, n])), [layoutNodes]);

  return (
    <div
      ref={svgContainerRef}
      style={{ flex: 1, overflow: 'hidden', cursor: 'grab', position: 'relative' }}
      onMouseDown={onPanStart}
    >
      <svg ref={svgRef} width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={tokens.colors.borderAccent} />
          </marker>
          <marker id="arrow-critical" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={tokens.colors.accent} />
          </marker>
          <marker id="arrow-chain" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={tokens.colors.cyan} />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Edges */}
          {edges.map((e) => {
            const from = nodeMap.get(e.from);
            const to = nodeMap.get(e.to);
            if (!from || !to) return null;

            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const cx = (x1 + x2) / 2;

            const isChain = selectedId
              ? highlightSet.has(e.from) && highlightSet.has(e.to)
              : false;
            const isCritical = criticalPath.has(e.from) && criticalPath.has(e.to);
            const stroke = isChain ? tokens.colors.cyan : isCritical ? tokens.colors.accent : tokens.colors.borderAccent;
            const marker = isChain ? 'url(#arrow-chain)' : isCritical ? 'url(#arrow-critical)' : 'url(#arrow)';
            const opacity = selectedId && !isChain ? 0.2 : 1;

            return (
              <path
                key={`${e.from}-${e.to}`}
                d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                fill="none"
                stroke={stroke}
                strokeWidth={isChain ? 2 : isCritical ? 1.5 : 1}
                markerEnd={marker}
                opacity={opacity}
              />
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((n) => {
            const isSelected = n.id === selectedId;
            const isHovered = n.id === hoveredId;
            const isInChain = highlightSet.size > 0 && highlightSet.has(n.id);
            const isCritical = criticalPath.has(n.id);
            const isDimmed = selectedId && !isInChain;
            const color = statusColor(n.status);
            const borderColor = isSelected ? tokens.colors.cyan : isCritical && !selectedId ? tokens.colors.accent : color;

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onNodeClick(n.id); }}
                onMouseEnter={() => onNodeHover(n.id)}
                onMouseLeave={() => onNodeHover(null)}
                opacity={isDimmed ? 0.25 : 1}
              >
                {(isSelected || (isCritical && !selectedId)) && (
                  <rect
                    x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={13} ry={13}
                    fill="none" stroke={isSelected ? tokens.colors.cyan : tokens.colors.accent}
                    strokeWidth={2} opacity={0.6}
                  />
                )}
                <rect
                  x={0} y={0} width={NODE_W} height={NODE_H} rx={10} ry={10}
                  fill={isHovered || isSelected ? statusDim(n.status) : tokens.colors.bgCard}
                  stroke={borderColor} strokeWidth={isSelected ? 2 : 1}
                />
                {/* Status color bar */}
                <rect x={0} y={0} width={4} height={NODE_H} rx={10} ry={10} fill={color} />
                <rect x={0} y={10} width={4} height={NODE_H - 10} fill={color} />
                <text x={14} y={22} fontSize={10} fontFamily={tokens.font.mono} fill={color} fontWeight={700}>
                  {n.id.replace('TASK_', '')}
                </text>
                <text x={14} y={38} fontSize={11} fontFamily={tokens.font.sans} fill={tokens.colors.text} fontWeight={500}>
                  {n.title.length > 16 ? n.title.slice(0, 15) + '…' : n.title}
                </text>
                <text x={14} y={52} fontSize={9} fontFamily={tokens.font.sans} fill={tokens.colors.textDim}>
                  {n.type}
                </text>
                {n.isUnblocked && n.status === 'CREATED' && (
                  <circle cx={NODE_W - 12} cy={12} r={6} fill={tokens.colors.green} opacity={0.9} />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
