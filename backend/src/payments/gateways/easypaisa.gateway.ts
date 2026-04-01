import { Injectable } from '@nestjs/common';
import {
  PaymentGateway,
  PaymentInitResult,
  PaymentVerifyResult,
} from '../interfaces/payment-gateway.interface.js';

@Injectable()
export class EasyPaisaGateway implements PaymentGateway {
  readonly name = 'easypaisa';

  async initiatePayment(params: {
    amount: number;
    currency: string;
    purchaseIds: string[];
    sellerId: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    // Stub: simulate EasyPaisa payment initiation
    const transactionId = `EP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    return {
      transactionId,
      redirectUrl: `https://sandbox.easypaisa.com.pk/checkout?txn=${transactionId}`,
      status: 'initiated',
    };
  }

  async verifyCallback(payload: Record<string, any>): Promise<PaymentVerifyResult> {
    // Stub: simulate callback verification
    const transactionId = payload.transactionId || payload.orderId || '';
    const status = payload.status || 'success';
    if (status === 'success') {
      return { transactionId, status: 'completed' };
    }
    return { transactionId, status: 'failed', reason: `EasyPaisa error: ${status}` };
  }
}
