import { PaymentGateway, PaymentInitResult, PaymentVerifyResult } from './interfaces/payment-gateway.interface.js';
import { JazzCashGateway } from './gateways/jazzcash.gateway.js';
import { EasyPaisaGateway } from './gateways/easypaisa.gateway.js';
import { CardGateway } from './gateways/card.gateway.js';
import { PaymentMethod } from '../packages/schemas/package-purchase.schema.js';
export declare class PaymentsService {
    private readonly jazzCashGateway;
    private readonly easyPaisaGateway;
    private readonly cardGateway;
    private readonly gateways;
    constructor(jazzCashGateway: JazzCashGateway, easyPaisaGateway: EasyPaisaGateway, cardGateway: CardGateway);
    getGateway(method: PaymentMethod): PaymentGateway;
    initiatePayment(method: PaymentMethod, params: {
        amount: number;
        currency: string;
        purchaseIds: string[];
        sellerId: string;
        callbackUrl: string;
    }): Promise<PaymentInitResult>;
    verifyCallback(method: PaymentMethod, payload: Record<string, any>): Promise<PaymentVerifyResult>;
}
