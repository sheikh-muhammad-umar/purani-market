import { EasyPaisaGateway } from './easypaisa.gateway';

describe('EasyPaisaGateway', () => {
  let gateway: EasyPaisaGateway;

  beforeEach(() => {
    gateway = new EasyPaisaGateway();
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
        transactionId: 'EP-123',
        status: 'success',
      });
      expect(result.status).toBe('completed');
    });

    it('should return failed for non-success status', async () => {
      const result = await gateway.verifyCallback({
        transactionId: 'EP-123',
        status: 'declined',
      });
      expect(result.status).toBe('failed');
      expect(result.reason).toContain('declined');
    });
  });
});
