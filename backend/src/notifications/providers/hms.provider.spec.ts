import { Test, TestingModule } from '@nestjs/testing';
import { HmsProvider } from './hms.provider';

describe('HmsProvider', () => {
  let provider: HmsProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HmsProvider],
    }).compile();

    provider = module.get<HmsProvider>(HmsProvider);
  });

  describe('sendToDevice', () => {
    it('should log and return true (stub)', async () => {
      const result = await provider.sendToDevice('hms-token-123', {
        title: 'Test',
        body: 'Test body',
      });
      expect(result).toBe(true);
    });

    it('should handle payload with data', async () => {
      const result = await provider.sendToDevice('hms-token-123', {
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
        ['hms-1', 'hms-2'],
        { title: 'Test', body: 'Body' },
      );
      expect(result).toBe(true);
    });
  });
});
