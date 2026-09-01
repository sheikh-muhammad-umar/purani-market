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
    /** Signs with the gateway's own hasher, so this checks policy not algorithm. */
    const sign = (payload: Record<string, string>): string =>
      (
        gateway as unknown as {
          generateSecureHash(p: Record<string, string>): string;
        }
      ).generateSecureHash(payload);

    it('completes a correctly signed success callback', async () => {
      const payload = {
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
      };
      const result = await gateway.verifyCallback({
        ...payload,
        pp_SecureHash: sign(payload),
      });
      expect(result.status).toBe('completed');
    });

    it('refuses a callback carrying no secure hash', async () => {
      // The hole this closes: verification used to be skipped when the hash was
      // absent, so the caller's own response code decided the outcome. The
      // callback route sits outside the API-key guard, so a hand-written POST of
      // just these two fields marked a purchase paid.
      const result = await gateway.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
      });
      expect(result.status).toBe('failed');
    });

    it('refuses an unsigned callback when no secret is configured', async () => {
      const noSalt = new JazzCashGateway({
        get: (key: string) => {
          if (key === CONFIG_KEYS.JAZZCASH_INTEGRITY_SALT) return '';
          if (key === CONFIG_KEYS.ALLOW_UNSIGNED_CALLBACKS) return false;
          return 'x';
        },
      } as unknown as ConfigService);

      const result = await noSalt.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
      });
      expect(result.status).toBe('failed');
    });

    it('accepts an unsigned callback only when explicitly opted in', async () => {
      // The escape hatch exists because no environment here has the gateway
      // secrets, so sandbox testing would otherwise be impossible. It is refused
      // outright in production regardless of the variable — see configuration.ts.
      const optedIn = new JazzCashGateway({
        get: (key: string) => {
          if (key === CONFIG_KEYS.JAZZCASH_INTEGRITY_SALT) return '';
          if (key === CONFIG_KEYS.ALLOW_UNSIGNED_CALLBACKS) return true;
          return 'x';
        },
      } as unknown as ConfigService);

      const result = await optedIn.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
      });
      expect(result.status).toBe('completed');
    });

    it('still verifies when a secret is configured, opt-in or not', async () => {
      // The opt-in only covers a missing secret. With one present an unsigned
      // callback is always refused, so the flag cannot weaken a real deployment.
      const optedInWithSalt = new JazzCashGateway({
        get: (key: string) => {
          if (key === CONFIG_KEYS.JAZZCASH_INTEGRITY_SALT) return 'testsalt';
          if (key === CONFIG_KEYS.ALLOW_UNSIGNED_CALLBACKS) return true;
          return 'x';
        },
      } as unknown as ConfigService);

      const result = await optedInWithSalt.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
      });
      expect(result.status).toBe('failed');
    });

    it('ignores fields the application adds before verification', async () => {
      // handlePaymentCallback merges in `transactionId`, and `paymentMethod`
      // arrives in the request body. Neither was signed by JazzCash, so hashing
      // them made the digest cover data the gateway never saw and no genuine
      // callback could ever match.
      const payload = {
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
      };
      const result = await gateway.verifyCallback({
        ...payload,
        pp_SecureHash: sign(payload),
        transactionId: 'T20240101120000',
        paymentMethod: 'jazzcash',
      });
      expect(result.status).toBe('completed');
    });

    it('is not enabled by a truthy non-boolean flag', async () => {
      const sloppyFlag = new JazzCashGateway({
        get: (key: string) => {
          if (key === CONFIG_KEYS.JAZZCASH_INTEGRITY_SALT) return '';
          // e.g. the raw string from an environment variable.
          if (key === CONFIG_KEYS.ALLOW_UNSIGNED_CALLBACKS) return 'true';
          return 'x';
        },
      } as unknown as ConfigService);

      const result = await sloppyFlag.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
      });
      expect(result.status).toBe('failed');
    });

    it('refuses a callback whose hash does not match', async () => {
      const result = await gateway.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
        pp_SecureHash: 'DEADBEEF',
      });
      expect(result.status).toBe('failed');
    });

    it('should return failed for non-success response code', async () => {
      const payload = {
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: '999',
      };
      const result = await gateway.verifyCallback({
        ...payload,
        pp_SecureHash: sign(payload),
      });
      expect(result.status).toBe('failed');
    });

    /**
     * A genuine callback is form-encoded primitives, but the payload type is an
     * index signature over `unknown`. Coercing a nested value would hash the
     * literal "[object Object]", so the signature check would fail with nothing
     * in the logs pointing at the cause.
     */
    it('should reject a callback whose field is not a primitive', async () => {
      const warn = jest
        .spyOn(
          (gateway as unknown as { logger: { warn: jest.Mock } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await gateway.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
        pp_SecureHash: 'deadbeef',
        pp_BillReference: { nested: 'value' } as unknown as string,
      });

      expect(result.status).toBe('failed');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('was not a primitive'),
      );
      warn.mockRestore();
    });

    it('should hash primitive fields of every type without complaint', async () => {
      const result = await gateway.verifyCallback({
        pp_TxnRefNo: 'T20240101120000',
        pp_ResponseCode: JAZZCASH_SUCCESS_CODE,
        pp_SecureHash: 'deadbeef',
        pp_Amount: 100000,
        pp_Retry: false,
        pp_Optional: undefined,
      });

      // The hash will not match a fabricated one, but it is a mismatch rather
      // than a rejection for a malformed field.
      expect(result.status).toBe('failed');
      expect(result.reason).toBeDefined();
    });
  });
});
