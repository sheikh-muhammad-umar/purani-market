"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const user_activity_schema_js_1 = require("./schemas/user-activity.schema.js");
const recommendation_service_js_1 = require("./recommendation.service.js");
const chatbot_service_js_1 = require("./chatbot.service.js");
const ai_controller_js_1 = require("./ai.controller.js");
const listings_module_js_1 = require("../listings/listings.module.js");
let AiModule = class AiModule {
};
exports.AiModule = AiModule;
exports.AiModule = AiModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: user_activity_schema_js_1.UserActivity.name, schema: user_activity_schema_js_1.UserActivitySchema },
            ]),
            schedule_1.ScheduleModule.forRoot(),
            listings_module_js_1.ListingsModule,
        ],
        controllers: [ai_controller_js_1.AiController],
        providers: [recommendation_service_js_1.RecommendationService, chatbot_service_js_1.ChatbotService],
        exports: [recommendation_service_js_1.RecommendationService, chatbot_service_js_1.ChatbotService],
    })
], AiModule);
//# sourceMappingURL=ai.module.js.map