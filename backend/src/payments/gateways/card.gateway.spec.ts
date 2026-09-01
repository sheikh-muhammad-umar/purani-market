import { ConfigService } from '@nestjs/config';
import { CardGateway } from './card.gateway';
import {
  CONFIG_KEYS,
  STRIPE_CHECKOUT_COMPLETED,
  STRIPE_PAYMENT_STATUS_PAID,
} from '../constants';

const mockConfigService = {
  get: (key: string) => {
    const config: Record<string, string> = {
      [CONFIG_KEYS.STRIPE_SECRET_KEY]: 'sk_test_placeholder',
      [CONFIG_KEYS.STRIPE_WEBHOOK_SECRET]: 'whsec_test',
      [CONFIG_KEYS.STRIPE_SUCCESS_URL]:
        'http://localhost:4200/packages/success',
      [CONFIG_KEYS.STRIPE_CANCEL_URL]: 'http://localhost:4200/packages/cancel',
    };
    return config[key] ?? '';
  },
} as unknown as ConfigService;

describe('CardGateway', () => {
  let gateway: CardGateway;

  beforeEach(() => {
    gateway = new CardGateway(mockConfigService);
  });

  it('should have name "card"', () => {
    expect(gateway.name).toBe('card');
  });

  describe('verifyCallback', () => {
    it('should return failed when no session ID provided', async () => {
      const result = await gateway.verifyCallback({});
      expect(result.status).toBe('failed');
    });

    it('does not trust a webhook-shaped body on the return path', async () => {
      // This body previously short-circuited to handleWebhookEvent, which read
      // payment_status straight off it with no signature check — bypassing the
      // verification done on the real webhook route. It is now confirmed against
      // Stripe, which cannot succeed for a session that was never created.
      const result = await gateway.verifyCallback({
        type: STRIPE_CHECKOUT_COMPLETED,
        data: {
          object: {
            id: 'cs_forged_123',
            payment_status: STRIPE_PAYMENT_STATUS_PAID,
          },
        },
      });
      expect(result.status).toBe('failed');
    });
  });
});
