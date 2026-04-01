import { Test, TestingModule } from '@nestjs/testing';
import { FcmProvider } from './fcm.provider';

describe('FcmProvider', () => {
  let provider: FcmProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FcmProvider],
    }).compile();

    provider = module.get<FcmProvider>(FcmProvider);
  });

  describe('sendToDevice', () => {
    it('should log and return true (stub)', async () => {
      const result = await provider.sendToDevice('token-123', {
        title: 'Test',
        body: 'Test body',
      });
      expect(result).toBe(true);
    });

    it('should handle payload with data', async () => {
      const result = await provider.sendToDevice('token-123', {
        title: 'Test',
        body: 'Body',
        data: { type: 'test' },
      });
      expect(result).toBe(true);
    });
  });

  describe('sendToMultipleDevices', () => {
    it('should send to all tokens and return true', async () => {
      const result = await provider.sendToMultipleDevices(
        ['token-1', 'token-2'],
        { title: 'Test', body: 'Body' },
      );
      expect(result).toBe(true);
    });
  });
});
