"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifiedUserGuard = void 0;
const common_1 = require("@nestjs/common");
let VerifiedUserGuard = class VerifiedUserGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            return false;
        }
        if (user.email && !user.emailVerified) {
            throw new common_1.ForbiddenException('Please verify your email address to access this feature');
        }
        if (user.phone && !user.phoneVerified) {
            throw new common_1.ForbiddenException('Please verify your phone number to access this feature');
        }
        return true;
    }
};
exports.VerifiedUserGuard = VerifiedUserGuard;
exports.VerifiedUserGuard = VerifiedUserGuard = __decorate([
    (0, common_1.Injectable)()
], VerifiedUserGuard);
//# sourceMappingURL=verified-user.guard.js.map