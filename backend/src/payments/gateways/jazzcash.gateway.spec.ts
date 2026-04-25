import { ConfigService } from '@nestjs/config';
import { JazzCashGateway } from './jazzcash.gateway';
import { CONFIG_KEYS, JAZZCASH_SUCCESS_CODE } from '../constants';

const mockConfigService = {
  get: (key: string) => {
    const config: Record<string, string> = {
      [CONFIG_KEYS.JAZZCASH_MERCHANT_ID]: 'TestMerchant',
      [CONFIG_KEYS.JAZZCASH_PASSWORD]: '0123456789',
      [CONFIG_KEYS.JAZZCASH_INTEGRITY_SALT]: 'testsalt',
      [CONFIG_KEYS.JAZZCASH_BASE_URL]:
        'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
      [CONFIG_KEYS.JAZZCASH_RETURN_URL]:
        'http://localhost:3000/api/packages/payment-callback',
    };
    return config[key] ?? '';
  },
} as unknown as ConfigService;

describe('JazzCashGateway', () => {
  let gateway: JazzCashGateway;

  beforeEach(() => {
    gateway = new JazzCashGateway(mockConfigService);
  });

  it('should have name "jazzcash"', () => {
    expect(gateway.name).toBe('jazzcash');
  });

  describe('initiatePayment', () => {
    it('should return a transaction ID and redirect URL', async () => {
      const result = await gateway.initiatePayment({
        amount: 1000,
        currency: 'PKR',
        purchaseIds: ['p1'],
        sellerId: 'seller1',
        callbackUrl: '/callback',
      });

      expect(result.transactionId).toMatch(/^T\d+/);
      expect(result.redirectUrl).toContain('jazzcash');
      expect(result.status).toBe('initiated');
    });
  });

  describe('verifyCallback', () => {
    it('should return completed for success response code', async () => {
      const result = await gateway.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
      });
      expect(result.status).toBe('completed');
    });

    it('should return failed for non-success response code', async () => {
      const result = await gateway.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: '999',
      });
      expect(result.status).toBe('failed');
    });
  });
});
