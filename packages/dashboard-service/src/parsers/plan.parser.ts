import type { FileParser } from './parser.interface.js';
import type { PlanData, PlanPhase } from '../events/event-types.js';

export class PlanParser implements FileParser<PlanData> {
  public canParse(filePath: string): boolean {
    return filePath.endsWith('plan.md') && !filePath.includes('TASK_');
  }

  public parse(content: string, _filePath: string): PlanData {
    const lines = content.split('\n');
    const overview = this.extractSection(lines, '## Project Overview');
    const phases = this.extractPhases(lines);
    const currentFocus = this.extractCurrentFocus(lines);
    const decisions = this.extractDecisions(lines);

    return { overview, phases, currentFocus, decisions };
  }

  private extractSection(lines: ReadonlyArray<string>, heading: string): string {
    const startIdx = lines.findIndex((l) => l.trim() === heading);
    if (startIdx === -1) return '';

    const result: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) break;
      result.push(lines[i]);
    }
    return result.join('\n').trim();
  }

  private extractPhases(lines: ReadonlyArray<string>): ReadonlyArray<PlanPhase> {
    const phases: PlanPhase[] = [];
    let i = 0;

    while (i < lines.length) {
      const phaseMatch = lines[i].match(/^### Phase \d+: (.+)$/);
      if (phaseMatch) {
        const phase = this.parsePhase(lines, i, phaseMatch[1]);
        phases.push(phase);
      }
      i++;
    }

    return phases;
  }

  private parsePhase(lines: ReadonlyArray<string>, startIdx: number, name: string): PlanPhase {
    let status = '';
    let description = '';
    const milestones: string[] = [];
    const taskMap: PlanPhase['taskMap'][number][] = [];

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('### ') || line.startsWith('## ')) break;

      const statusMatch = line.match(/^\*\*Status\*\*:\s*(.+)$/);
      if (statusMatch) {
        status = statusMatch[1].trim();
        continue;
      }

      const descMatch = line.match(/^\*\*Description\*\*:\s*(.+)$/);
      if (descMatch) {
        description = descMatch[1].trim();
        continue;
      }

      const milestoneMatch = line.match(/^- \[[ x]\] (.+)$/);
      if (milestoneMatch) {
        milestones.push(milestoneMatch[1].trim());
        continue;
      }

      if (line.trim().startsWith('| TASK_')) {
        const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
        if (cells.length >= 4) {
          taskMap.push({
            taskId: cells[0],
            title: cells[1],
            status: cells[2],
            priority: cells[3],
          });
        }
      }
    }

    return { name, status, description, milestones, taskMap };
  }

  private extractCurrentFocus(lines: ReadonlyArray<string>): PlanData['currentFocus'] {
    const focusIdx = lines.findIndex((l) => l.trim() === '## Current Focus');
    let activePhase = '';
    let activeMilestone = '';
    const nextPriorities: string[] = [];
    let supervisorGuidance = '';
    let guidanceNote = '';

    if (focusIdx === -1) {
      return { activePhase, activeMilestone, nextPriorities, supervisorGuidance, guidanceNote };
    }

    for (let i = focusIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) break;

      const phaseMatch = line.match(/^\*\*Active Phase\*\*:\s*(.+)$/);
      if (phaseMatch) { activePhase = phaseMatch[1].trim(); continue; }

      const mileMatch = line.match(/^\*\*Active Milestone\*\*:\s*(.+)$/);
      if (mileMatch) { activeMilestone = mileMatch[1].trim(); continue; }

      const prioMatch = line.match(/^\d+\.\s+(.+)$/);
      if (prioMatch) { nextPriorities.push(prioMatch[1].trim()); continue; }

      const guidMatch = line.match(/^\*\*Supervisor Guidance\*\*:\s*(.+)$/);
      if (guidMatch) { supervisorGuidance = guidMatch[1].trim(); continue; }

      const noteMatch = line.match(/^\*\*Guidance Note\*\*:\s*(.+)$/);
      if (noteMatch) { guidanceNote = noteMatch[1].trim(); continue; }
    }

    return { activePhase, activeMilestone, nextPriorities, supervisorGuidance, guidanceNote };
  }

  private extractDecisions(lines: ReadonlyArray<string>): PlanData['decisions'] {
    const decisionsIdx = lines.findIndex((l) => l.trim() === '## Decisions Log');
    const decisions: PlanData['decisions'][number][] = [];

    if (decisionsIdx === -1) return decisions;

    for (let i = decisionsIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) break;

      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (
        cells.length >= 3 &&
        cells[0] !== 'Date' &&
        !cells[0].startsWith('---') &&
        !cells[0].startsWith(':---')
      ) {
        decisions.push({
          date: cells[0],
          decision: cells[1],
          rationale: cells[2],
        });
      }
    }

    return decisions;
  }
}
