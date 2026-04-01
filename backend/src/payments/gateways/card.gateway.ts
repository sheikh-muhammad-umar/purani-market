import { Injectable } from '@nestjs/common';
import {
  PaymentGateway,
  PaymentInitResult,
  PaymentVerifyResult,
} from '../interfaces/payment-gateway.interface.js';

@Injectable()
export class CardGateway implements PaymentGateway {
  readonly name = 'card';

  async initiatePayment(params: {
    amount: number;
    currency: string;
    purchaseIds: string[];
    sellerId: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    // Stub: simulate card payment initiation
    const transactionId = `CARD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    return {
      transactionId,
      redirectUrl: `https://sandbox.stripe.com/checkout?txn=${transactionId}`,
      status: 'initiated',
    };
  }

  async verifyCallback(payload: Record<string, any>): Promise<PaymentVerifyResult> {
    // Stub: simulate callback verification
    const transactionId = payload.transactionId || payload.charge_id || '';
    const status = payload.status || 'succeeded';
    if (status === 'succeeded') {
      return { transactionId, status: 'completed' };
    }
    return { transactionId, status: 'failed', reason: `Card payment error: ${status}` };
  }
}
