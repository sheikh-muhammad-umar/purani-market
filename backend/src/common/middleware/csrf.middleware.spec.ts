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

    const cookiesSet: Record<string, any> = {};
    const res = {
      cookie: jest.fn((name: string, value: string, opts: any) => {
        cookiesSet[name] = { value, opts };
      }),
    } as unknown as Response;

    const next: NextFunction = jest.fn();

    return { req, res, next, cookiesSet };
  }

  describe('CSRF token cookie issuance', () => {
    it('should issue a CSRF cookie when none is present on a GET request', () => {
      const { req, res, next } = createMockReqRes({ method: 'GET' });
      middleware.use(req, res, next);
      expect(res.cookie).toHaveBeenCalledWith(
        '_csrf',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          sameSite: 'strict',
        }),
      );
      expect(next).toHaveBeenCalled();
    });

    it('should not issue a new CSRF cookie when one already exists', () => {
      const { req, res, next } = createMockReqRes({
        method: 'GET',
        cookies: { _csrf: 'existing-token' },
      });
      middleware.use(req, res, next);
      expect(res.cookie).not.toHaveBeenCalled();
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

  describe('state-changing methods (POST, PUT, PATCH, DELETE)', () => {
    it('should allow request when CSRF cookie and header match', () => {
      const token = 'valid-csrf-token';
      const { req, res, next } = createMockReqRes({
        method: 'POST',
        cookies: { _csrf: token },
        headers: { 'x-csrf-token': token },
      });
      middleware.use(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when CSRF cookie is missing', () => {
      const { req, res, next } = createMockReqRes({
        method: 'POST',
        cookies: {},
        headers: { 'x-csrf-token': 'some-token' },
      });
      expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
      expect(() => middleware.use(req, res, next)).toThrow(
        'Invalid CSRF token',
      );
    });

    it('should throw ForbiddenException when CSRF header is missing', () => {
      const { req, res, next } = createMockReqRes({
        method: 'POST',
        cookies: { _csrf: 'some-token' },
        headers: {},
      });
      expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when cookie and header tokens do not match', () => {
      const { req, res, next } = createMockReqRes({
        method: 'POST',
        cookies: { _csrf: 'token-a' },
        headers: { 'x-csrf-token': 'token-b' },
      });
      expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
    });

    it.each(['PUT', 'PATCH', 'DELETE'])(
      'should validate CSRF for %s requests',
      (method) => {
        const { req, res, next } = createMockReqRes({
          method,
          cookies: {},
          headers: {},
        });
        expect(() => middleware.use(req, res, next)).toThrow(
          ForbiddenException,
        );
      },
    );
  });
});
