"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HmsProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HmsProvider = void 0;
const common_1 = require("@nestjs/common");
let HmsProvider = HmsProvider_1 = class HmsProvider {
    logger = new common_1.Logger(HmsProvider_1.name);
    async sendToDevice(deviceToken, payload) {
        this.logger.log(`[HMS] Sending to ${deviceToken}: ${payload.title} - ${payload.body}`);
        if (payload.data) {
            this.logger.debug(`[HMS] Data: ${JSON.stringify(payload.data)}`);
        }
        return true;
    }
    async sendToMultipleDevices(deviceTokens, payload) {
        this.logger.log(`[HMS] Sending to ${deviceTokens.length} devices: ${payload.title}`);
        for (const token of deviceTokens) {
            await this.sendToDevice(token, payload);
        }
        return true;
    }
};
exports.HmsProvider = HmsProvider;
exports.HmsProvider = HmsProvider = HmsProvider_1 = __decorate([
    (0, common_1.Injectable)()
], HmsProvider);
//# sourceMappingURL=hms.provider.js.map