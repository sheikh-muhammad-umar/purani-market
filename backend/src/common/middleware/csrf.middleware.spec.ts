import { CsrfMiddleware } from './csrf.middleware';
import { ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
  });

  function createMockReqRes(overrides?: {
    method?: string;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  }) {
    const req = {
      method: overrides?.method ?? 'GET',
      cookies: overrides?.cookies ?? {},
      headers: overrides?.headers ?? {},
    } as unknown as Request;

    const res = {
      cookie: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as Response;

    const next: NextFunction = jest.fn();

    return { req, res, next };
  }

  describe('CSRF token cookie issuance', () => {
    it('should issue a CSRF cookie when none is present', () => {
      const { req, res, next } = createMockReqRes({ method: 'GET' });
      middleware.use(req, res, next);
      expect(res.cookie).toHaveBeenCalledWith(
        '_csrf',
        expect.any(String),
        expect.objectContaining({ httpOnly: false }),
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'x-csrf-token',
        expect.any(String),
      );
      expect(next).toHaveBeenCalled();
    });

    it('should echo existing token in response header when cookie exists', () => {
      const { req, res, next } = createMockReqRes({
        method: 'GET',
        cookies: { _csrf: 'existing-token' },
      });
      middleware.use(req, res, next);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith(
        'x-csrf-token',
        'existing-token',
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('safe methods (GET, HEAD, OPTIONS)', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])(
      'should skip CSRF validation for %s requests',
      (method) => {
        const { req, res, next } = createMockReqRes({ method });
        middleware.use(req, res, next);
        expect(next).toHaveBeenCalled();
      },
    );
  });

  describe('outside local development', () => {
    // NODE_ENV is 'test' here, which is not 'development' — so validation runs.
    // The bypass used to be `!IS_PRODUCTION`, which also disabled the check in
    // staging: a real deployment on its own domain over TLS, where cookies
    // behave exactly as they do in production.

    it('rejects a POST carrying no CSRF token', () => {
      const { req, res, next } = createMockReqRes({
        method: 'POST',
        cookies: {},
        headers: {},
      });

      expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects a POST whose header does not match the cookie', () => {
      const { req, res, next } = createMockReqRes({
        method: 'POST',
        cookies: { _csrf: 'cookie-token' },
        headers: { 'x-csrf-token': 'different-token' },
      });

      expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
    });
  });

  describe('production CSRF validation', () => {
    const originalEnv = process.env.NODE_ENV;

    // The IS_PRODUCTION constant is evaluated at module load time,
    // so we test the validation logic directly by verifying the
    // middleware's cookie/header comparison contract.

    it('should allow request when CSRF cookie and header match', () => {
      const token = 'valid-csrf-token';
      const { req, res, next } = createMockReqRes({
        method: 'POST',
        cookies: { _csrf: token },
        headers: { 'x-csrf-token': token },
      });
      // In non-production this passes regardless; in production it
      // passes because cookie === header.
      middleware.use(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
