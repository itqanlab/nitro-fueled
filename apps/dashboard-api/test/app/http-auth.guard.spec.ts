import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { HttpAuthGuard } from '../../src/app/auth/http-auth.guard';

describe('HttpAuthGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createMockContext(url: string, headers: Record<string, string | undefined> = {}) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url, headers }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('when AUTH_ENABLED is not set or false', () => {
    it('allows all requests when AUTH_ENABLED is undefined', () => {
      delete process.env['AUTH_ENABLED'];
      delete process.env['HTTP_API_KEYS'];
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks');
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows all requests when AUTH_ENABLED=false', () => {
      process.env['AUTH_ENABLED'] = 'false';
      delete process.env['HTTP_API_KEYS'];
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks');
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('when AUTH_ENABLED=true', () => {
    beforeEach(() => {
      process.env['AUTH_ENABLED'] = 'true';
      process.env['HTTP_API_KEYS'] = 'test-key-1, test-key-2';
    });

    it('allows request with valid Bearer token', () => {
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks', {
        authorization: 'Bearer test-key-1',
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows request with valid x-api-key header', () => {
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks', {
        'x-api-key': 'test-key-2',
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows request with raw Authorization header (no Bearer prefix)', () => {
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks', {
        authorization: 'test-key-1',
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('rejects request with no credentials', () => {
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks', {});
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('rejects request with invalid key', () => {
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks', {
        authorization: 'Bearer wrong-key',
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('rejects request when no keys are configured', () => {
      process.env['HTTP_API_KEYS'] = '';
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks', {
        authorization: 'Bearer any-key',
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('exempt routes', () => {
    beforeEach(() => {
      process.env['AUTH_ENABLED'] = 'true';
      process.env['HTTP_API_KEYS'] = 'secret-key';
    });

    const exemptPaths = [
      '/health',
      '/api/v1/health',
      '/api/docs',
      '/api/docs-json',
      '/api/docs-yaml',
      '/api/docs/',
      '/api/docs/some-asset',
    ];

    exemptPaths.forEach((path) => {
      it(`allows unauthenticated access to ${path}`, () => {
        const guard = new HttpAuthGuard();
        const context = createMockContext(path, {});
        expect(guard.canActivate(context)).toBe(true);
      });
    });

    it('allows unauthenticated access to health with query string', () => {
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/v1/health?format=full', {});
      expect(guard.canActivate(context)).toBe(true);
    });

    it('does not exempt /api/tasks', () => {
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks', {});
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('fail-closed behavior', () => {
    it('denies protected routes when enabled with no configured keys', () => {
      process.env['AUTH_ENABLED'] = 'true';
      process.env['HTTP_API_KEYS'] = '';
      const guard = new HttpAuthGuard();
      const context = createMockContext('/api/tasks', {
        authorization: 'Bearer some-key',
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('still allows exempt routes when enabled with no configured keys', () => {
      process.env['AUTH_ENABLED'] = 'true';
      process.env['HTTP_API_KEYS'] = '';
      const guard = new HttpAuthGuard();
      const context = createMockContext('/health', {});
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
