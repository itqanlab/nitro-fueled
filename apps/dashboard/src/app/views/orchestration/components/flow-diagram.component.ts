import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PhaseNode {
  id: string;
  agent: {
    name: string;
    title: string;
    type: string;
    description: string;
    outputs: string[];
    successCriteria: string[];
  };
  order: number;
  estimatedDuration: number;
  deliverables: string[];
  successCriteria: string[];
}

@Component({
  selector: 'app-flow-diagram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flow-diagram.component.html',
  styleUrls: ['./flow-diagram.component.scss']
})
export class FlowDiagramComponent implements OnInit {
  @Input() flow: any;

  phaseNodes: PhaseNode[] = [];
  hoveredNode: PhaseNode | null = null;

  ngOnInit(): void {
    if (this.flow?.phases) {
      this.phaseNodes = this.flow.phases.map((phase: any, index: number) => ({
        id: `phase-${phase.order}`,
        agent: phase.agent,
        order: phase.order,
        estimatedDuration: phase.estimatedDuration,
        deliverables: phase.deliverables,
        successCriteria: phase.successCriteria
      }));
    }
  }

  getNodeColor(agentType: string): string {
    const colors: Record<string, string> = {
      'pm': '#3B82F6',      // Blue
      'architect': '#8B5CF6', // Purple
      'developer': '#10B981', // Green
      'reviewer': '#F59E0B',  // Amber
      'tester': '#EF4444',    // Red
      'designer': '#EC4899',  // Pink
      'writer': '#14B8A6',   // Teal
      'researcher': '#6366F1', // Indigo
      'devops': '#84CC16'     // Lime
    };
    return colors[agentType] || '#6B7280'; // Gray
  }

  getAgentInitials(agentName: string): string {
    const parts = agentName.split('-');
    if (parts.length >= 2) {
      return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
    }
    return agentName.substring(0, 2).toUpperCase();
  }

  onNodeHover(node: PhaseNode, event: MouseEvent): void {
    this.hoveredNode = node;
  }

  onNodeLeave(): void {
    this.hoveredNode = null;
  }

  getNodePosition(index: number, total: number): { left: string; top: string } {
    const spacing = 100; // Percentage spacing between nodes
    const left = (index * spacing) / (total - 1);
    return {
      left: `${Math.min(Math.max(left, 0), 100)}%`,
      top: '50%'
    };
  }
}