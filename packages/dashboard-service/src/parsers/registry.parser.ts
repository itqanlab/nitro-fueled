import type { FileParser } from './parser.interface.js';
import type { TaskRecord } from '../events/event-types.js';

export class RegistryParser implements FileParser<ReadonlyArray<TaskRecord>> {
  public canParse(filePath: string): boolean {
    return filePath.endsWith('registry.md');
  }

  public parse(content: string, _filePath: string): ReadonlyArray<TaskRecord> {
    const records: TaskRecord[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|') || trimmed.startsWith('| Task ID') || trimmed.startsWith('|---')) {
        continue;
      }

      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (cells.length < 5) continue;

      const id = cells[0];
      if (!id.startsWith('TASK_')) continue;

      records.push({
        id,
        status: cells[1] as TaskRecord['status'],
        type: cells[2],
        description: cells[3],
        created: cells[4],
      });
    }

    return records;
  }
}
