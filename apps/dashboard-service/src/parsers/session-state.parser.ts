import type { FileParser } from './parser.interface.js';
import type { OrchestratorState } from '../events/event-types.js';
import { StateParser } from './state.parser.js';

export class SessionStateParser implements FileParser<OrchestratorState> {
  private readonly stateParser = new StateParser();

  public canParse(filePath: string): boolean {
    return /sessions[\\/]SESSION_[^/\\]+[\\/]state\.md$/.test(filePath);
  }

  public parse(content: string, filePath: string): OrchestratorState {
    return this.stateParser.parse(content, filePath);
  }
}
