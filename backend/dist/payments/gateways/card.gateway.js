"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardGateway = void 0;
const common_1 = require("@nestjs/common");
let CardGateway = class CardGateway {
    name = 'card';
    async initiatePayment(params) {
        const transactionId = `CARD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        return {
            transactionId,
            redirectUrl: `https://sandbox.stripe.com/checkout?txn=${transactionId}`,
            status: 'initiated',
        };
    }
    async verifyCallback(payload) {
        const transactionId = payload.transactionId || payload.charge_id || '';
        const status = payload.status || 'succeeded';
        if (status === 'succeeded') {
            return { transactionId, status: 'completed' };
        }
        return { transactionId, status: 'failed', reason: `Card payment error: ${status}` };
    }
};
exports.CardGateway = CardGateway;
exports.CardGateway = CardGateway = __decorate([
    (0, common_1.Injectable)()
], CardGateway);
//# sourceMappingURL=card.gateway.js.map