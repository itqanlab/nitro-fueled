export type ProjectStatus = 'active' | 'inactive' | 'has-updates';

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly status: ProjectStatus;
  readonly taskCount: number;
  readonly client: string;
  readonly stackTags: readonly string[];
  readonly teams: readonly string[];
}
