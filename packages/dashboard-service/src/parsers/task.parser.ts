import type { FileParser } from './parser.interface.js';
import type { TaskDefinition, TaskType, TaskPriority } from '../events/event-types.js';

export class TaskParser implements FileParser<TaskDefinition> {
  public canParse(filePath: string): boolean {
    return /TASK_\d{4}_\d{3}\/task\.md$/.test(filePath);
  }

  public parse(content: string, _filePath: string): TaskDefinition {
    const lines = content.split('\n');

    const title = this.extractTitle(lines);
    const metadata = this.extractMetadata(lines);
    const description = this.extractDescription(lines);
    const dependencies = this.extractListSection(lines, 'Dependencies');
    const acceptanceCriteria = this.extractChecklistSection(lines, 'Acceptance Criteria');
    const references = this.extractListSection(lines, 'References');

    return {
      title,
      type: (metadata.Type ?? 'FEATURE') as TaskType,
      priority: (metadata.Priority ?? 'P2-Medium') as TaskPriority,
      complexity: metadata.Complexity ?? 'Medium',
      description,
      dependencies,
      acceptanceCriteria,
      references,
    };
  }

  private extractTitle(lines: ReadonlyArray<string>): string {
    for (const line of lines) {
      const match = line.match(/^# Task:\s*(.+)$/);
      if (match) return match[1].trim();
    }
    return '';
  }

  private extractMetadata(lines: ReadonlyArray<string>): Record<string, string> {
    const metadata: Record<string, string> = {};
    const metaIdx = lines.findIndex((l) => l.trim() === '## Metadata');
    if (metaIdx === -1) return metadata;

    for (let i = metaIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) break;
      const cells = lines[i].split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length >= 2 && cells[0] !== 'Field' && !cells[0].startsWith('---')) {
        metadata[cells[0]] = cells[1];
      }
    }

    return metadata;
  }

  private extractDescription(lines: ReadonlyArray<string>): string {
    const descIdx = lines.findIndex((l) => l.trim() === '## Description');
    if (descIdx === -1) return '';

    const result: string[] = [];
    for (let i = descIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) break;
      result.push(lines[i]);
    }
    return result.join('\n').trim();
  }

  private extractListSection(lines: ReadonlyArray<string>, heading: string): ReadonlyArray<string> {
    const idx = lines.findIndex((l) => l.trim() === `## ${heading}`);
    if (idx === -1) return [];

    const items: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) break;
      const match = lines[i].match(/^- (.+)$/);
      if (match) items.push(match[1].trim());
    }
    return items;
  }

  private extractChecklistSection(lines: ReadonlyArray<string>, heading: string): ReadonlyArray<string> {
    const idx = lines.findIndex((l) => l.trim() === `## ${heading}`);
    if (idx === -1) return [];

    const items: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) break;
      const match = lines[i].match(/^- \[[ x]\] (.+)$/);
      if (match) items.push(match[1].trim());
    }
    return items;
  }
}
