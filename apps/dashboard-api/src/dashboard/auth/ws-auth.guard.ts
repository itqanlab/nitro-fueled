import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import type { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);
  private readonly validTokens: Set<string>;

  private readonly authEnabled: boolean;

  constructor() {
    const tokens = process.env['WS_API_KEYS'];
    this.validTokens = new Set(
      tokens
        ? tokens.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
        : []
    );

    this.authEnabled = this.validTokens.size > 0;

    if (this.authEnabled) {
      this.logger.log(`WebSocket auth guard enabled with ${this.validTokens.size} key(s)`);
    } else {
      this.logger.log('WebSocket auth guard disabled (no WS_API_KEYS configured)');
    }
  }

  canActivate(context: ExecutionContext): Observable<boolean> {
    return of(this.validateConnection(context));
  }

  private validateConnection(context: ExecutionContext): boolean {
    if (!this.authEnabled) {
      return true;
    }

    const client = context.switchToWs().getClient<Socket>() as Socket;
    const authHeader = client.handshake.auth?.token || client.handshake.headers['authorization'];

    let token: string | null = null;

    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      } else {
        token = authHeader;
      }
    }

    if (!token) {
      this.logger.warn(`Connection rejected (no token provided): ${client.id}`);
      return false;
    }

    const isValid = this.validTokens.has(token);

    if (!isValid) {
      this.logger.warn(`Connection rejected (invalid token): ${client.id}`);
    }

    return isValid;
  }
}
