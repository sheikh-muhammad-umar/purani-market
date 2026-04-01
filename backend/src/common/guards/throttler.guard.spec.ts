import { ExecutionContext } from '@nestjs/common';
import { CustomThrottlerGuard } from './throttler.guard';
import {
  ThrottlerGuard as NestThrottlerGuard,
  ThrottlerException,
  ThrottlerLimitDetail,
} from '@nestjs/throttler';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    // Create instance without constructor deps — we only test the override method
    guard = Object.create(CustomThrottlerGuard.prototype);
  });

  it('should be defined', () => {
    expect(CustomThrottlerGuard).toBeDefined();
  });

  it('should extend NestJS ThrottlerGuard', () => {
    expect(CustomThrottlerGuard.prototype).toBeInstanceOf(NestThrottlerGuard);
  });

  describe('throwThrottlingException', () => {
    it('should set Retry-After header and throw ThrottlerException', async () => {
      const mockHeader = jest.fn();
      const mockRes = { header: mockHeader };

      // Mock getRequestResponse to return our mock response
      (guard as any).getRequestResponse = jest.fn().mockReturnValue({
        req: {},
        res: mockRes,
      });

      const mockContext = {} as ExecutionContext;
      const throttlerLimitDetail: ThrottlerLimitDetail = {
        totalHits: 11,
        timeToExpire: 600000, // 600 seconds remaining
        isBlocked: false,
        timeToBlockExpire: 0,
        ttl: 900000,
        limit: 10,
        key: 'test-key',
        tracker: '127.0.0.1',
      };

      await expect(
        (guard as any).throwThrottlingException(mockContext, throttlerLimitDetail),
      ).rejects.toThrow(ThrottlerException);

      expect(mockHeader).toHaveBeenCalledWith('Retry-After', '600');
    });

    it('should calculate Retry-After in seconds (ceiling)', async () => {
      const mockHeader = jest.fn();
      const mockRes = { header: mockHeader };

      (guard as any).getRequestResponse = jest.fn().mockReturnValue({
        req: {},
        res: mockRes,
      });

      const mockContext = {} as ExecutionContext;
      const throttlerLimitDetail: ThrottlerLimitDetail = {
        totalHits: 15,
        timeToExpire: 450500, // 450.5 seconds → should ceil to 451
        isBlocked: false,
        timeToBlockExpire: 0,
        ttl: 900000,
        limit: 10,
        key: 'test-key',
        tracker: '192.168.1.1',
      };

      await expect(
        (guard as any).throwThrottlingException(mockContext, throttlerLimitDetail),
      ).rejects.toThrow(ThrottlerException);

      expect(mockHeader).toHaveBeenCalledWith('Retry-After', '451');
    });

    it('should include retry time in the error message', async () => {
      const mockHeader = jest.fn();
      const mockRes = { header: mockHeader };

      (guard as any).getRequestResponse = jest.fn().mockReturnValue({
        req: {},
        res: mockRes,
      });

      const mockContext = {} as ExecutionContext;
      const throttlerLimitDetail: ThrottlerLimitDetail = {
        totalHits: 11,
        timeToExpire: 300000,
        isBlocked: false,
        timeToBlockExpire: 0,
        ttl: 900000,
        limit: 10,
        key: 'test-key',
        tracker: '10.0.0.1',
      };

      await expect(
        (guard as any).throwThrottlingException(mockContext, throttlerLimitDetail),
      ).rejects.toThrow('Too Many Requests. Please retry after 300 seconds.');
    });
  });
});
