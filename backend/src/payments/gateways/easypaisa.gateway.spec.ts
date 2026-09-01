import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { EasyPaisaGateway } from './easypaisa.gateway';
import { CONFIG_KEYS, EASYPAISA_HASH_ALGORITHM } from '../constants';

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
    /**
     * Mirrors the gateway's hash: values sorted by key, joined with '&', HMAC'd
     * with the configured key. Duplicated rather than shared because the gateway
     * computes it inline; the point of these tests is the accept/refuse policy.
     */
    const sign = (payload: Record<string, string>): string => {
      const values = Object.keys(payload)
        .sort()
        .map((k) => payload[k])
        .join('&');
      return createHmac(EASYPAISA_HASH_ALGORITHM, 'testhashkey')
        .update(values)
        .digest('hex');
    };

    it('completes a correctly signed success callback', async () => {
      const payload = { orderRefNumber: 'EP-123', status: '0000' };
      const result = await gateway.verifyCallback({
        ...payload,
        merchantHashedReq: sign(payload),
      });
      expect(result.status).toBe('completed');
    });

    it('refuses a callback carrying no hash', async () => {
      // Verification used to be skipped when the hash was absent, so a
      // hand-written POST with a success status was enough to mark a purchase
      // paid on a route that needs no API key.
      const result = await gateway.verifyCallback({
        orderRefNumber: 'EP-123',
        status: '0000',
      });
      expect(result.status).toBe('failed');
    });

    it('refuses a callback whose hash does not match', async () => {
      const result = await gateway.verifyCallback({
        orderRefNumber: 'EP-123',
        status: '0000',
        merchantHashedReq: 'deadbeef',
      });
      expect(result.status).toBe('failed');
    });

    it('should return failed for non-success status', async () => {
      const payload = { orderRefNumber: 'EP-123', status: '0001' };
      const result = await gateway.verifyCallback({
        ...payload,
        merchantHashedReq: sign(payload),
      });
      expect(result.status).toBe('failed');
    });
  });
});
