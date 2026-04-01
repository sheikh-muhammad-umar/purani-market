"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const conversation_schema_js_1 = require("./schemas/conversation.schema.js");
const message_schema_js_1 = require("./schemas/message.schema.js");
const user_schema_js_1 = require("../users/schemas/user.schema.js");
const messaging_service_js_1 = require("./messaging.service.js");
const messaging_controller_js_1 = require("./messaging.controller.js");
const messaging_gateway_js_1 = require("./messaging.gateway.js");
const listings_module_js_1 = require("../listings/listings.module.js");
let MessagingModule = class MessagingModule {
};
exports.MessagingModule = MessagingModule;
exports.MessagingModule = MessagingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: conversation_schema_js_1.Conversation.name, schema: conversation_schema_js_1.ConversationSchema },
                { name: message_schema_js_1.Message.name, schema: message_schema_js_1.MessageSchema },
                { name: user_schema_js_1.User.name, schema: user_schema_js_1.UserSchema },
            ]),
            listings_module_js_1.ListingsModule,
        ],
        controllers: [messaging_controller_js_1.MessagingController],
        providers: [messaging_service_js_1.MessagingService, messaging_gateway_js_1.MessagingGateway],
        exports: [messaging_service_js_1.MessagingService, messaging_gateway_js_1.MessagingGateway, mongoose_1.MongooseModule],
    })
], MessagingModule);
//# sourceMappingURL=messaging.module.js.map