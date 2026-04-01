import { CorsMiddleware } from './cors.middleware';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

describe('CorsMiddleware', () => {
  let middleware: CorsMiddleware;
  let configService: ConfigService;

  function createMockReqRes(overrides?: {
    method?: string;
    origin?: string;
  }) {
    const req = {
      method: overrides?.method ?? 'GET',
      headers: {
        origin: overrides?.origin,
      },
    } as unknown as Request;

    const headers: Record<string, string> = {};
    const res = {
      setHeader: jest.fn((key: string, value: string) => {
        headers[key] = value;
      }),
      sendStatus: jest.fn(),
      _headers: headers,
    } as unknown as Response;

    const next: NextFunction = jest.fn();

    return { req, res, next, headers };
  }

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('https://example.com,https://app.example.com'),
    } as unknown as ConfigService;
    middleware = new CorsMiddleware(configService);
  });

  it('should set Access-Control-Allow-Origin for an allowed origin', () => {
    const { req, res, next } = createMockReqRes({
      origin: 'https://example.com',
    });
    middleware.use(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://example.com',
    );
    expect(next).toHaveBeenCalled();
  });

  it('should not set Access-Control-Allow-Origin for a disallowed origin', () => {
    const { req, res, next } = createMockReqRes({
      origin: 'https://evil.com',
    });
    middleware.use(req, res, next);
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      expect.anything(),
    );
    expect(next).toHaveBeenCalled();
  });

  it('should not set Access-Control-Allow-Origin when no origin header is present', () => {
    const { req, res, next } = createMockReqRes({});
    middleware.use(req, res, next);
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      expect.anything(),
    );
  });

  it('should set standard CORS headers on every request', () => {
    const { req, res, next } = createMockReqRes({});
    middleware.use(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization,X-CSRF-Token',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Credentials',
      'true',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Max-Age',
      '86400',
    );
  });

  it('should respond with 204 for OPTIONS preflight requests', () => {
    const { req, res, next } = createMockReqRes({ method: 'OPTIONS' });
    middleware.use(req, res, next);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() for non-OPTIONS requests', () => {
    const { req, res, next } = createMockReqRes({ method: 'POST' });
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.sendStatus).not.toHaveBeenCalled();
  });

  it('should handle empty cors.allowedOrigins config', () => {
    configService = {
      get: jest.fn().mockReturnValue(''),
    } as unknown as ConfigService;
    middleware = new CorsMiddleware(configService);

    const { req, res, next } = createMockReqRes({
      origin: 'https://example.com',
    });
    middleware.use(req, res, next);
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      expect.anything(),
    );
    expect(next).toHaveBeenCalled();
  });
});
