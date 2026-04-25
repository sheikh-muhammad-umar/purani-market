import { ConfigService } from '@nestjs/config';
import { EasyPaisaGateway } from './easypaisa.gateway';
import { CONFIG_KEYS } from '../constants';

const mockConfigService = {
  get: (key: string) => {
    const config: Record<string, string> = {
      [CONFIG_KEYS.EASYPAISA_STORE_ID]: 'TestStore',
      [CONFIG_KEYS.EASYPAISA_HASH_KEY]: 'testhashkey',
      [CONFIG_KEYS.EASYPAISA_BASE_URL]:
        'https://easypay.easypaisa.com.pk/easypay/Index.jsf',
      [CONFIG_KEYS.EASYPAISA_RETURN_URL]:
        'http://localhost:3000/api/packages/payment-callback',
    };
    return config[key] ?? '';
  },
} as unknown as ConfigService;

describe('EasyPaisaGateway', () => {
  let gateway: EasyPaisaGateway;

  beforeEach(() => {
    gateway = new EasyPaisaGateway(mockConfigService);
  });

  it('should have name "easypaisa"', () => {
    expect(gateway.name).toBe('easypaisa');
  });

  describe('initiatePayment', () => {
    it('should return a transaction ID and redirect URL', async () => {
      const result = await gateway.initiatePayment({
        amount: 500,
        currency: 'PKR',
        purchaseIds: ['p1'],
        sellerId: 'seller1',
        callbackUrl: '/callback',
      });

      expect(result.transactionId).toMatch(/^EP-/);
      expect(result.redirectUrl).toContain('easypaisa');
      expect(result.status).toBe('initiated');
    });
  });

  describe('verifyCallback', () => {
    it('should return completed for success status', async () => {
      const result = await gateway.verifyCallback({
        orderRefNumber: 'EP-123',
        status: '0000',
      });
      expect(result.status).toBe('completed');
    });

    it('should return failed for non-success status', async () => {
      const result = await gateway.verifyCallback({
        orderRefNumber: 'EP-123',
        status: '0001',
      });
      expect(result.status).toBe('failed');
    });
  });
});
