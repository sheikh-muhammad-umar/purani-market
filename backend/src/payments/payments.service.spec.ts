import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JazzCashGateway } from './gateways/jazzcash.gateway';
import { EasyPaisaGateway } from './gateways/easypaisa.gateway';
import { CardGateway } from './gateways/card.gateway';
import { PaymentMethod } from '../packages/schemas/package-purchase.schema';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let jazzCashGateway: JazzCashGateway;
  let easyPaisaGateway: EasyPaisaGateway;
  let cardGateway: CardGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: JazzCashGateway,
          useValue: {
            name: 'jazzcash',
            initiatePayment: jest.fn().mockResolvedValue({
              transactionId: 'JC-123',
              redirectUrl: 'https://sandbox.jazzcash.com.pk/checkout?txn=JC-123',
              status: 'initiated',
            }),
            verifyCallback: jest.fn().mockResolvedValue({
              transactionId: 'JC-123',
              status: 'completed',
            }),
          },
        },
        {
          provide: EasyPaisaGateway,
          useValue: {
            name: 'easypaisa',
            initiatePayment: jest.fn().mockResolvedValue({
              transactionId: 'EP-123',
              redirectUrl: 'https://sandbox.easypaisa.com.pk/checkout?txn=EP-123',
              status: 'initiated',
            }),
            verifyCallback: jest.fn().mockResolvedValue({
              transactionId: 'EP-123',
              status: 'completed',
            }),
          },
        },
        {
          provide: CardGateway,
          useValue: {
            name: 'card',
            initiatePayment: jest.fn().mockResolvedValue({
              transactionId: 'CARD-123',
              redirectUrl: 'https://sandbox.stripe.com/checkout?txn=CARD-123',
              status: 'initiated',
            }),
            verifyCallback: jest.fn().mockResolvedValue({
              transactionId: 'CARD-123',
              status: 'completed',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jazzCashGateway = module.get<JazzCashGateway>(JazzCashGateway);
    easyPaisaGateway = module.get<EasyPaisaGateway>(EasyPaisaGateway);
    cardGateway = module.get<CardGateway>(CardGateway);
  });

  describe('getGateway', () => {
    it('should return JazzCash gateway', () => {
      const gw = service.getGateway(PaymentMethod.JAZZCASH);
      expect(gw).toBeDefined();
    });

    it('should return EasyPaisa gateway', () => {
      const gw = service.getGateway(PaymentMethod.EASYPAISA);
      expect(gw).toBeDefined();
    });

    it('should return Card gateway', () => {
      const gw = service.getGateway(PaymentMethod.CARD);
      expect(gw).toBeDefined();
    });

    it('should throw for unsupported payment method', () => {
      expect(() => service.getGateway('bitcoin' as PaymentMethod)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('initiatePayment', () => {
    it('should initiate JazzCash payment', async () => {
      const result = await service.initiatePayment(PaymentMethod.JAZZCASH, {
        amount: 1000,
        currency: 'PKR',
        purchaseIds: ['p1'],
        sellerId: 'seller1',
        callbackUrl: '/callback',
      });

      expect(result.transactionId).toBe('JC-123');
      expect(result.status).toBe('initiated');
      expect(jazzCashGateway.initiatePayment).toHaveBeenCalled();
    });

    it('should initiate EasyPaisa payment', async () => {
      const result = await service.initiatePayment(PaymentMethod.EASYPAISA, {
        amount: 500,
        currency: 'PKR',
        purchaseIds: ['p2'],
        sellerId: 'seller2',
        callbackUrl: '/callback',
      });

      expect(result.transactionId).toBe('EP-123');
      expect(easyPaisaGateway.initiatePayment).toHaveBeenCalled();
    });

    it('should initiate Card payment', async () => {
      const result = await service.initiatePayment(PaymentMethod.CARD, {
        amount: 2000,
        currency: 'PKR',
        purchaseIds: ['p3'],
        sellerId: 'seller3',
        callbackUrl: '/callback',
      });

      expect(result.transactionId).toBe('CARD-123');
      expect(cardGateway.initiatePayment).toHaveBeenCalled();
    });
  });

  describe('verifyCallback', () => {
    it('should verify JazzCash callback', async () => {
      const result = await service.verifyCallback(PaymentMethod.JAZZCASH, {
        transactionId: 'JC-123',
        responseCode: '000',
      });

      expect(result.status).toBe('completed');
      expect(jazzCashGateway.verifyCallback).toHaveBeenCalled();
    });

    it('should verify Card callback', async () => {
      const result = await service.verifyCallback(PaymentMethod.CARD, {
        transactionId: 'CARD-123',
        status: 'succeeded',
      });

      expect(result.status).toBe('completed');
    });
  });
});
