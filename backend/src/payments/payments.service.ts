import { Injectable, BadRequestException } from '@nestjs/common';
import {
  PaymentGateway,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentInitParams,
} from './interfaces/payment-gateway.interface.js';
import { JazzCashGateway } from './gateways/jazzcash.gateway.js';
import { EasyPaisaGateway } from './gateways/easypaisa.gateway.js';
import { CardGateway } from './gateways/card.gateway.js';
import { PaymentMethod } from '../packages/schemas/package-purchase.schema.js';
import { ERROR } from '../common/constants/error-messages.js';

@Injectable()
export class PaymentsService {
  private readonly gateways: ReadonlyMap<PaymentMethod, PaymentGateway>;

  constructor(
    jazzCashGateway: JazzCashGateway,
    easyPaisaGateway: EasyPaisaGateway,
    cardGateway: CardGateway,
  ) {
    this.gateways = new Map<PaymentMethod, PaymentGateway>([
      [PaymentMethod.JAZZCASH, jazzCashGateway],
      [PaymentMethod.EASYPAISA, easyPaisaGateway],
      [PaymentMethod.CARD, cardGateway],
    ]);
  }

  getGateway(method: PaymentMethod): PaymentGateway {
    const gateway = this.gateways.get(method);
    if (!gateway) {
      throw new BadRequestException(
        `${ERROR.PAYMENT_UNSUPPORTED_METHOD}: ${method}`,
      );
    }
    return gateway;
  }

  async initiatePayment(
    method: PaymentMethod,
    params: PaymentInitParams,
  ): Promise<PaymentInitResult> {
    return this.getGateway(method).initiatePayment(params);
  }

  async verifyCallback(
    method: PaymentMethod,
    payload: Record<string, unknown>,
  ): Promise<PaymentVerifyResult> {
    return this.getGateway(method).verifyCallback(payload);
  }
}
