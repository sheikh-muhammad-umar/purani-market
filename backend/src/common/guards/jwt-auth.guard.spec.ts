import { JwtAuthGuard } from './jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  describe('handleRequest', () => {
    it('should return the user when authentication succeeds', () => {
      const user = { id: '123', email: 'test@example.com', role: 'buyer' };
      const result = guard.handleRequest(null, user, null);
      expect(result).toBe(user);
    });

    it('should throw UnauthorizedException when user is falsy', () => {
      expect(() => guard.handleRequest(null, null, null)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(null, null, null)).toThrow(
        'Invalid or expired token',
      );
    });

    it('should throw UnauthorizedException when user is undefined', () => {
      expect(() => guard.handleRequest(null, undefined, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw the original error when err is provided', () => {
      const originalError = new Error('Token expired');
      expect(() =>
        guard.handleRequest(originalError, null, null),
      ).toThrow(originalError);
    });

    it('should throw the original error even if user is present', () => {
      const originalError = new Error('Some auth error');
      const user = { id: '123' };
      expect(() =>
        guard.handleRequest(originalError, user, null),
      ).toThrow(originalError);
    });
  });
});
