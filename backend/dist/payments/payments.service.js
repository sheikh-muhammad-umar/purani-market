"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const jazzcash_gateway_js_1 = require("./gateways/jazzcash.gateway.js");
const easypaisa_gateway_js_1 = require("./gateways/easypaisa.gateway.js");
const card_gateway_js_1 = require("./gateways/card.gateway.js");
const package_purchase_schema_js_1 = require("../packages/schemas/package-purchase.schema.js");
let PaymentsService = class PaymentsService {
    jazzCashGateway;
    easyPaisaGateway;
    cardGateway;
    gateways;
    constructor(jazzCashGateway, easyPaisaGateway, cardGateway) {
        this.jazzCashGateway = jazzCashGateway;
        this.easyPaisaGateway = easyPaisaGateway;
        this.cardGateway = cardGateway;
        this.gateways = new Map([
            [package_purchase_schema_js_1.PaymentMethod.JAZZCASH, this.jazzCashGateway],
            [package_purchase_schema_js_1.PaymentMethod.EASYPAISA, this.easyPaisaGateway],
            [package_purchase_schema_js_1.PaymentMethod.CARD, this.cardGateway],
        ]);
    }
    getGateway(method) {
        const gateway = this.gateways.get(method);
        if (!gateway) {
            throw new common_1.BadRequestException(`Unsupported payment method: ${method}`);
        }
        return gateway;
    }
    async initiatePayment(method, params) {
        const gateway = this.getGateway(method);
        return gateway.initiatePayment(params);
    }
    async verifyCallback(method, payload) {
        const gateway = this.getGateway(method);
        return gateway.verifyCallback(payload);
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jazzcash_gateway_js_1.JazzCashGateway,
        easypaisa_gateway_js_1.EasyPaisaGateway,
        card_gateway_js_1.CardGateway])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map