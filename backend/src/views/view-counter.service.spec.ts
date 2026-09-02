import { Test, TestingModule } from '@nestjs/testing';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { ViewCounterService } from './view-counter.service';
import { VIEW_DEDUP_WINDOW_SECONDS } from '../common/constants/app.constants';

describe('ViewCounterService', () => {
  let service: ViewCounterService;
  let redis: { set: jest.Mock };

  const req = { headers: { 'user-agent': 'agent' }, ip: '1.2.3.4' };

  beforeEach(async () => {
    redis = { set: jest.fn().mockResolvedValue('OK') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViewCounterService,
        { provide: getRedisConnectionToken(), useValue: redis },
      ],
    }).compile();

    service = module.get(ViewCounterService);
  });

  it('counts the first view in the window', async () => {
    await expect(
      service.shouldCountView('listing', 'abc', { userId: 'u1' }),
    ).resolves.toBe(true);
  });

  it('holds the key for exactly one hour', async () => {
    await service.shouldCountView('listing', 'abc', { userId: 'u1' });

    // Repeat interest counts, but only once an hour, so reloading adds nothing
    // while coming back tomorrow does.
    expect(redis.set).toHaveBeenCalledWith(
      expect.any(String),
      '1',
      'EX',
      3600,
      'NX',
    );
    expect(VIEW_DEDUP_WINDOW_SECONDS).toBe(3600);
  });

  it('does not count a repeat view inside the window', async () => {
    // NX returns null when the key is already there.
    redis.set.mockResolvedValue(null);

    await expect(
      service.shouldCountView('listing', 'abc', { userId: 'u1' }),
    ).resolves.toBe(false);
  });

  it('keys listings and shorts apart', async () => {
    await service.shouldCountView('listing', 'abc', { userId: 'u1' });
    await service.shouldCountView('short', 'abc', { userId: 'u1' });

    const [listingKey] = redis.set.mock.calls[0] as string[];
    const [shortKey] = redis.set.mock.calls[1] as string[];
    // Same id in both collections must not share an allowance.
    expect(listingKey).not.toEqual(shortKey);
    expect(listingKey).toContain('listing');
    expect(shortKey).toContain('short');
  });

  it('tells two signed-in viewers apart', async () => {
    await service.shouldCountView('listing', 'abc', { userId: 'u1' });
    await service.shouldCountView('listing', 'abc', { userId: 'u2' });

    const [first] = redis.set.mock.calls[0] as string[];
    const [second] = redis.set.mock.calls[1] as string[];
    expect(first).not.toEqual(second);
  });

  it('falls back to a fingerprint for guests', async () => {
    await service.shouldCountView('listing', 'abc', { req });

    const [key] = redis.set.mock.calls[0] as string[];
    // Most traffic is not signed in; without a fallback identity every guest
    // would share one allowance and only the first would ever count.
    expect(key).toMatch(/:a:[0-9a-f]{16}$/);
  });

  it('gives two guests on different addresses their own allowance', async () => {
    await service.shouldCountView('listing', 'abc', { req });
    await service.shouldCountView('listing', 'abc', {
      req: { headers: { 'user-agent': 'agent' }, ip: '5.6.7.8' },
    });

    const [first] = redis.set.mock.calls[0] as string[];
    const [second] = redis.set.mock.calls[1] as string[];
    expect(first).not.toEqual(second);
  });

  it('does not count the view when Redis is unavailable', async () => {
    redis.set.mockRejectedValue(new Error('Redis down'));

    // Counting blind would let one reloading visitor inflate the number without
    // limit; a count that misses a few is the lesser fault.
    await expect(
      service.shouldCountView('listing', 'abc', { userId: 'u1' }),
    ).resolves.toBe(false);
  });
});
