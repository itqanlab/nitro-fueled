export type AgentModel = 'opus' | 'sonnet' | 'codex';
export type AgentTeam = 'Engineering' | 'Design';

export interface Agent {
  readonly name: string;
  readonly model: AgentModel;
  readonly team: AgentTeam;
  readonly installed: boolean;
}
