import { CronLock } from './cron-lock.decorator.js';
import { CronLockService } from '../services/cron-lock.service.js';

describe('CronLock decorator', () => {
  afterEach(() => {
    // Reset the singleton the decorator reads between tests.
    (CronLockService as unknown as { instance: unknown }).instance = null;
    jest.restoreAllMocks();
  });

  class Sample {
    ran = 0;

    @CronLock()
    async job(): Promise<string> {
      this.ran++;
      return 'done';
    }
  }

  it('routes the call through runExclusive with the ClassName.method key', async () => {
    const runExclusive = jest
      .fn()
      .mockImplementation((_key: string, fn: () => Promise<unknown>) => fn());
    jest
      .spyOn(CronLockService, 'getInstance')
      .mockReturnValue({ runExclusive } as unknown as CronLockService);

    const sample = new Sample();
    const result = await sample.job();

    expect(result).toBe('done');
    expect(sample.ran).toBe(1);
    expect(runExclusive).toHaveBeenCalledWith(
      'Sample.job',
      expect.any(Function),
      expect.any(Number),
    );
  });

  it('does not run the body when the lock is held elsewhere', async () => {
    const runExclusive = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(CronLockService, 'getInstance')
      .mockReturnValue({ runExclusive } as unknown as CronLockService);

    const sample = new Sample();
    const result = await sample.job();

    expect(result).toBeUndefined();
    expect(sample.ran).toBe(0); // body skipped — another instance owns it
  });

  it('runs unlocked when the lock service is unavailable (early startup)', async () => {
    jest.spyOn(CronLockService, 'getInstance').mockReturnValue(null);

    const sample = new Sample();
    const result = await sample.job();

    expect(result).toBe('done');
    expect(sample.ran).toBe(1);
  });
});
