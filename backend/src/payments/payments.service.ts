import { Injectable, BadRequestException } from '@nestjs/common';
import {
  PaymentGateway,
  PaymentInitResult,
  PaymentVerifyResult,
} from './interfaces/payment-gateway.interface.js';
import { JazzCashGateway } from './gateways/jazzcash.gateway.js';
import { EasyPaisaGateway } from './gateways/easypaisa.gateway.js';
import { CardGateway } from './gateways/card.gateway.js';
import { PaymentMethod } from '../packages/schemas/package-purchase.schema.js';

@Injectable()
export class PaymentsService {
  private readonly gateways: Map<string, PaymentGateway>;

  constructor(
    private readonly jazzCashGateway: JazzCashGateway,
    private readonly easyPaisaGateway: EasyPaisaGateway,
    private readonly cardGateway: CardGateway,
  ) {
    this.gateways = new Map<string, PaymentGateway>([
      [PaymentMethod.JAZZCASH, this.jazzCashGateway],
      [PaymentMethod.EASYPAISA, this.easyPaisaGateway],
      [PaymentMethod.CARD, this.cardGateway],
    ]);
  }

  getGateway(method: PaymentMethod): PaymentGateway {
    const gateway = this.gateways.get(method);
    if (!gateway) {
      throw new BadRequestException(`Unsupported payment method: ${method}`);
    }
    return gateway;
  }

  async initiatePayment(
    method: PaymentMethod,
    params: {
      amount: number;
      currency: string;
      purchaseIds: string[];
      sellerId: string;
      callbackUrl: string;
    },
  ): Promise<PaymentInitResult> {
    const gateway = this.getGateway(method);
    return gateway.initiatePayment(params);
  }

  async verifyCallback(
    method: PaymentMethod,
    payload: Record<string, any>,
  ): Promise<PaymentVerifyResult> {
    const gateway = this.getGateway(method);
    return gateway.verifyCallback(payload);
  }
}
