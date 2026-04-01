import { PaymentGateway, PaymentInitResult, PaymentVerifyResult } from '../interfaces/payment-gateway.interface.js';
export declare class CardGateway implements PaymentGateway {
    readonly name = "card";
    initiatePayment(params: {
        amount: number;
        currency: string;
        purchaseIds: string[];
        sellerId: string;
        callbackUrl: string;
    }): Promise<PaymentInitResult>;
    verifyCallback(payload: Record<string, any>): Promise<PaymentVerifyResult>;
}
