"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const notifications_service_js_1 = require("./notifications.service.js");
const fcm_provider_js_1 = require("./providers/fcm.provider.js");
const hms_provider_js_1 = require("./providers/hms.provider.js");
const user_schema_js_1 = require("../users/schemas/user.schema.js");
const favorite_schema_js_1 = require("../favorites/schemas/favorite.schema.js");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: user_schema_js_1.User.name, schema: user_schema_js_1.UserSchema },
                { name: favorite_schema_js_1.Favorite.name, schema: favorite_schema_js_1.FavoriteSchema },
            ]),
        ],
        providers: [notifications_service_js_1.NotificationsService, fcm_provider_js_1.FcmProvider, hms_provider_js_1.HmsProvider],
        exports: [notifications_service_js_1.NotificationsService],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map