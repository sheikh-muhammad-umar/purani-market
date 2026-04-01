import { JazzCashGateway } from './jazzcash.gateway';

describe('JazzCashGateway', () => {
  let gateway: JazzCashGateway;

  beforeEach(() => {
    gateway = new JazzCashGateway();
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

      expect(result.transactionId).toMatch(/^JC-/);
      expect(result.redirectUrl).toContain('jazzcash');
      expect(result.status).toBe('initiated');
    });
  });

  describe('verifyCallback', () => {
    it('should return completed for success response code', async () => {
      const result = await gateway.verifyCallback({
        transactionId: 'JC-123',
        responseCode: '000',
      });
      expect(result.status).toBe('completed');
    });

    it('should return failed for non-success response code', async () => {
      const result = await gateway.verifyCallback({
        transactionId: 'JC-123',
        responseCode: '999',
      });
      expect(result.status).toBe('failed');
      expect(result.reason).toContain('999');
    });
  });
});
