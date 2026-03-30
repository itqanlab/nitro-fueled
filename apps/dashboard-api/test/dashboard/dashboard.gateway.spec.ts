import { WsAuthGuard } from '../../src/dashboard/auth/ws-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('WsAuthGuard', () => {
  let guard: WsAuthGuard;

  const validToken = 'test-valid-api-key';

  beforeAll(() => {
    process.env['WS_API_KEYS'] = `${validToken},another-valid-key`;
  });

  beforeEach(() => {
    guard = new WsAuthGuard();
  });

  afterAll(() => {
    delete process.env['WS_API_KEYS'];
  });

  describe('authentication failure', () => {
    it('should reject connection when no token provided', (done) => {
      const mockContext = {
        switchToWs: () => ({
          getClient: () => ({
            id: 'client-1',
            handshake: {
              auth: {},
              headers: {},
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockContext as ExecutionContext);

      result.subscribe((canActivate) => {
        expect(canActivate).toBe(false);
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      const mockContext = {
        switchToWs: () => ({
          getClient: () => ({
            id: 'client-2',
            handshake: {
              auth: { token: 'invalid-token' },
              headers: {},
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockContext as ExecutionContext);

      result.subscribe((canActivate) => {
        expect(canActivate).toBe(false);
        done();
      });
    });

    it('should reject all connections when no API keys configured', (done) => {
      delete process.env['WS_API_KEYS'];
      process.env['WS_API_KEYS'] = '';

      const newGuard = new WsAuthGuard();

      const mockContext = {
        switchToWs: () => ({
          getClient: () => ({
            id: 'client-3',
            handshake: {
              auth: { token: validToken },
              headers: {},
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = newGuard.canActivate(mockContext as ExecutionContext);

      result.subscribe((canActivate) => {
        expect(canActivate).toBe(false);
        done();
      });

      process.env['WS_API_KEYS'] = `${validToken},another-valid-key`;
    });
  });

  describe('authentication success', () => {
    it('should accept connection with valid Bearer token', (done) => {
      const mockContext = {
        switchToWs: () => ({
          getClient: () => ({
            id: 'client-4',
            handshake: {
              auth: { token: `Bearer ${validToken}` },
              headers: {},
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockContext as ExecutionContext);

      result.subscribe((canActivate) => {
        expect(canActivate).toBe(true);
        done();
      });
    });

    it('should accept connection with valid plain token', (done) => {
      const mockContext = {
        switchToWs: () => ({
          getClient: () => ({
            id: 'client-5',
            handshake: {
              auth: { token: validToken },
              headers: {},
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockContext as ExecutionContext);

      result.subscribe((canActivate) => {
        expect(canActivate).toBe(true);
        done();
      });
    });

    it('should accept connection with valid token in Authorization header', (done) => {
      const mockContext = {
        switchToWs: () => ({
          getClient: () => ({
            id: 'client-6',
            handshake: {
              auth: {},
              headers: { authorization: `Bearer ${validToken}` },
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockContext as ExecutionContext);

      result.subscribe((canActivate) => {
        expect(canActivate).toBe(true);
        done();
      });
    });

    it('should accept connection with valid token without Bearer prefix in Authorization header', (done) => {
      const mockContext = {
        switchToWs: () => ({
          getClient: () => ({
            id: 'client-7',
            handshake: {
              auth: {},
              headers: { authorization: validToken },
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockContext as ExecutionContext);

      result.subscribe((canActivate) => {
        expect(canActivate).toBe(true);
        done();
      });
    });
  });
});
