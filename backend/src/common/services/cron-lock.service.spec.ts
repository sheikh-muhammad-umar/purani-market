import { CronLockService } from './cron-lock.service.js';

/**
 * Builds a mock that mimics `model.findOneAndUpdate(...).exec()` and
 * `model.deleteOne(...).exec()`, capturing the filters passed so tests can
 * assert the owner-scoped queries.
 */
function makeMockModel() {
  const findOneAndUpdate = jest.fn();
  const deleteOne = jest.fn();

  const model = {
    findOneAndUpdate: findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    }),
    deleteOne: deleteOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    }),
  };

  return { model, findOneAndUpdate, deleteOne };
}

describe('CronLockService', () => {
  let mocks: ReturnType<typeof makeMockModel>;
  let service: CronLockService;

  beforeEach(() => {
    mocks = makeMockModel();
    service = new CronLockService(mocks.model as never);
  });

  describe('acquire', () => {
    it('returns true when the upsert succeeds (lock is free or expired)', async () => {
      const ok = await service.acquire('JobA');
      expect(ok).toBe(true);

      // Guarded on an expired/absent lock, and upserts our ownership.
      const [filter, update, options] = mocks.findOneAndUpdate.mock.calls[0];
      expect(filter._id).toBe('JobA');
      expect(filter.expiresAt).toHaveProperty('$lte');
      expect(update.$set.owner).toEqual(expect.any(String));
      expect(options.upsert).toBe(true);
    });

    it('returns false on duplicate-key error (a live lock already exists)', async () => {
      mocks.model.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue({ code: 11000 }),
      });

      const ok = await service.acquire('JobA');
      expect(ok).toBe(false);
    });

    it('returns false (does not run) when the database errors', async () => {
      mocks.model.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('connection lost')),
      });

      const ok = await service.acquire('JobA');
      expect(ok).toBe(false);
    });
  });

  describe('release', () => {
    it('deletes only a lock owned by this instance', async () => {
      await service.release('JobA');

      const [filter] = mocks.deleteOne.mock.calls[0];
      expect(filter._id).toBe('JobA');
      expect(filter.owner).toEqual(expect.any(String));
    });
  });

  describe('runExclusive', () => {
    it('runs the function and releases the lock when acquired', async () => {
      const fn = jest.fn().mockResolvedValue(42);

      const result = await service.runExclusive('JobA', fn);

      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mocks.deleteOne).toHaveBeenCalledTimes(1); // released
    });

    it('skips the function and returns undefined when not acquired', async () => {
      mocks.model.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue({ code: 11000 }),
      });
      const fn = jest.fn();

      const result = await service.runExclusive('JobA', fn);

      expect(result).toBeUndefined();
      expect(fn).not.toHaveBeenCalled();
      expect(mocks.deleteOne).not.toHaveBeenCalled(); // nothing to release
    });

    it('releases the lock even when the function throws', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('job failed'));

      await expect(service.runExclusive('JobA', fn)).rejects.toThrow(
        'job failed',
      );
      expect(mocks.deleteOne).toHaveBeenCalledTimes(1); // still released
    });
  });

  describe('getInstance / onModuleInit', () => {
    it('exposes the singleton after module init for the decorator to use', () => {
      service.onModuleInit();
      expect(CronLockService.getInstance()).toBe(service);
    });
  });
});
