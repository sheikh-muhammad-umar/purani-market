"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomThrottlerGuard = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
let CustomThrottlerGuard = class CustomThrottlerGuard extends throttler_1.ThrottlerGuard {
    async throwThrottlingException(context, throttlerLimitDetail) {
        const res = this.getRequestResponse(context).res;
        const retryAfterSeconds = Math.ceil(throttlerLimitDetail.timeToExpire / 1000);
        res.header('Retry-After', String(retryAfterSeconds));
        throw new throttler_1.ThrottlerException(`Too Many Requests. Please retry after ${retryAfterSeconds} seconds.`);
    }
};
exports.CustomThrottlerGuard = CustomThrottlerGuard;
exports.CustomThrottlerGuard = CustomThrottlerGuard = __decorate([
    (0, common_1.Injectable)()
], CustomThrottlerGuard);
//# sourceMappingURL=throttler.guard.js.map