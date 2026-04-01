"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EasyPaisaGateway = void 0;
const common_1 = require("@nestjs/common");
let EasyPaisaGateway = class EasyPaisaGateway {
    name = 'easypaisa';
    async initiatePayment(params) {
        const transactionId = `EP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        return {
            transactionId,
            redirectUrl: `https://sandbox.easypaisa.com.pk/checkout?txn=${transactionId}`,
            status: 'initiated',
        };
    }
    async verifyCallback(payload) {
        const transactionId = payload.transactionId || payload.orderId || '';
        const status = payload.status || 'success';
        if (status === 'success') {
            return { transactionId, status: 'completed' };
        }
        return { transactionId, status: 'failed', reason: `EasyPaisa error: ${status}` };
    }
};
exports.EasyPaisaGateway = EasyPaisaGateway;
exports.EasyPaisaGateway = EasyPaisaGateway = __decorate([
    (0, common_1.Injectable)()
], EasyPaisaGateway);
//# sourceMappingURL=easypaisa.gateway.js.map