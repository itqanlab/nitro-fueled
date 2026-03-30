import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

const EXEMPT_PATH_PREFIXES = [
  '/health',
  '/api/v1/health',
  '/api/docs',
  '/api/docs-json',
  '/api/docs-yaml',
  '/api/docs-css',
];

@Injectable()
export class HttpAuthGuard implements CanActivate {
  private readonly logger = new Logger(HttpAuthGuard.name);
  private readonly enabled: boolean;
  private readonly validKeys: Set<string>;

  constructor() {
    const authEnabled = process.env['AUTH_ENABLED'];
    const nodeEnv = process.env['NODE_ENV'];

    this.enabled =
      authEnabled === 'true' ||
      (authEnabled !== 'false' && nodeEnv === 'production');

    const keys = process.env['HTTP_API_KEYS'];
    this.validKeys = new Set(
      keys
        ? keys
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0)
        : [],
    );

    if (this.enabled && this.validKeys.size === 0) {
      this.logger.warn(
        'AUTH_ENABLED=true but no HTTP_API_KEYS configured — all protected routes will deny access',
      );
    }

    this.logger.log(
      this.enabled
        ? `HTTP auth guard enabled with ${this.validKeys.size} key(s)`
        : 'HTTP auth guard disabled',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    if (!this.enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      headers?: Record<string, string | undefined>;
    }>();

    if (this.isExempt(request.url)) {
      return true;
    }

    const key = this.extractKey(request.headers ?? {});
    if (!key) {
      this.logger.warn(`Unauthorized: no credentials provided for ${request.method} ${request.url}`);
      throw new UnauthorizedException('Authentication required');
    }

    if (!this.validKeys.has(key)) {
      this.logger.warn(
        `Unauthorized: invalid credentials for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    return true;
  }

  private isExempt(url: string): boolean {
    const path = url.split('?')[0] as string;
    return EXEMPT_PATH_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(prefix + '/'),
    );
  }

  private extractKey(
    headers: Record<string, string | undefined>,
  ): string | null {
    const authHeader = headers['authorization'];
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
      }
      return authHeader;
    }

    const apiKey = headers['x-api-key'];
    if (apiKey) {
      return apiKey;
    }

    return null;
  }
}
