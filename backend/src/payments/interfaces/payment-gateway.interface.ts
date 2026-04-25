export interface PaymentInitParams {
  amount: number;
  currency: string;
  purchaseIds: string[];
  sellerId: string;
  callbackUrl: string;
}

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
  initiatePayment(params: PaymentInitParams): Promise<PaymentInitResult>;
  verifyCallback(
    payload: Record<string, unknown>,
  ): Promise<PaymentVerifyResult>;
}
