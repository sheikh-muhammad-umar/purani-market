import { CardGateway } from './card.gateway';

describe('CardGateway', () => {
  let gateway: CardGateway;

  beforeEach(() => {
    gateway = new CardGateway();
  });

  it('should have name "card"', () => {
    expect(gateway.name).toBe('card');
  });

  describe('initiatePayment', () => {
    it('should return a transaction ID and redirect URL', async () => {
      const result = await gateway.initiatePayment({
        amount: 2000,
        currency: 'PKR',
        purchaseIds: ['p1'],
        sellerId: 'seller1',
        callbackUrl: '/callback',
      });

      expect(result.transactionId).toMatch(/^CARD-/);
      expect(result.redirectUrl).toContain('stripe');
      expect(result.status).toBe('initiated');
    });
  });

  describe('verifyCallback', () => {
    it('should return completed for succeeded status', async () => {
      const result = await gateway.verifyCallback({
        transactionId: 'CARD-123',
        status: 'succeeded',
      });
      expect(result.status).toBe('completed');
    });

    it('should return failed for non-succeeded status', async () => {
      const result = await gateway.verifyCallback({
        transactionId: 'CARD-123',
        status: 'declined',
      });
      expect(result.status).toBe('failed');
      expect(result.reason).toContain('declined');
    });
  });
});
