export interface PaymentInitResult {
  transactionId: string;
  redirectUrl: string;
  status: 'initiated';
}

export interface PaymentVerifyResult {
  transactionId: string;
  status: 'completed' | 'failed';
  reason?: string;
}

export interface PaymentGateway {
  readonly name: string;
  initiatePayment(params: {
    amount: number;
    currency: string;
    purchaseIds: string[];
    sellerId: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult>;
  verifyCallback(payload: Record<string, any>): Promise<PaymentVerifyResult>;
}
