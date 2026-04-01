"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JazzCashGateway = void 0;
const common_1 = require("@nestjs/common");
let JazzCashGateway = class JazzCashGateway {
    name = 'jazzcash';
    async initiatePayment(params) {
        const transactionId = `JC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        return {
            transactionId,
            redirectUrl: `https://sandbox.jazzcash.com.pk/checkout?txn=${transactionId}`,
            status: 'initiated',
        };
    }
    async verifyCallback(payload) {
        const transactionId = payload.transactionId || payload.pp_TxnRefNo || '';
        const responseCode = payload.responseCode || payload.pp_ResponseCode || '000';
        if (responseCode === '000') {
            return { transactionId, status: 'completed' };
        }
        return { transactionId, status: 'failed', reason: `JazzCash error: ${responseCode}` };
    }
};
exports.JazzCashGateway = JazzCashGateway;
exports.JazzCashGateway = JazzCashGateway = __decorate([
    (0, common_1.Injectable)()
], JazzCashGateway);
//# sourceMappingURL=jazzcash.gateway.js.map