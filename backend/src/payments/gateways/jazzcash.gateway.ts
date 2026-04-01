import { Injectable } from '@nestjs/common';
import {
  PaymentGateway,
  PaymentInitResult,
  PaymentVerifyResult,
} from '../interfaces/payment-gateway.interface.js';

@Injectable()
export class JazzCashGateway implements PaymentGateway {
  readonly name = 'jazzcash';

  async initiatePayment(params: {
    amount: number;
    currency: string;
    purchaseIds: string[];
    sellerId: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    // Stub: simulate JazzCash payment initiation
    const transactionId = `JC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    return {
      transactionId,
      redirectUrl: `https://sandbox.jazzcash.com.pk/checkout?txn=${transactionId}`,
      status: 'initiated',
    };
  }

  async verifyCallback(payload: Record<string, any>): Promise<PaymentVerifyResult> {
    // Stub: simulate callback verification
    const transactionId = payload.transactionId || payload.pp_TxnRefNo || '';
    const responseCode = payload.responseCode || payload.pp_ResponseCode || '000';
    if (responseCode === '000') {
      return { transactionId, status: 'completed' };
    }
    return { transactionId, status: 'failed', reason: `JazzCash error: ${responseCode}` };
  }
}
