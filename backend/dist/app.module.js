"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const throttler_1 = require("@nestjs/throttler");
const elasticsearch_1 = require("@nestjs/elasticsearch");
const ioredis_1 = require("@nestjs-modules/ioredis");
const configuration_js_1 = __importDefault(require("./config/configuration.js"));
const env_validation_js_1 = require("./config/env.validation.js");
const auth_module_js_1 = require("./auth/auth.module.js");
const users_module_js_1 = require("./users/users.module.js");
const categories_module_js_1 = require("./categories/categories.module.js");
const listings_module_js_1 = require("./listings/listings.module.js");
const search_module_js_1 = require("./search/search.module.js");
const packages_module_js_1 = require("./packages/packages.module.js");
const payments_module_js_1 = require("./payments/payments.module.js");
const messaging_module_js_1 = require("./messaging/messaging.module.js");
const notifications_module_js_1 = require("./notifications/notifications.module.js");
const location_module_js_1 = require("./location/location.module.js");
const reviews_module_js_1 = require("./reviews/reviews.module.js");
const ai_module_js_1 = require("./ai/ai.module.js");
const favorites_module_js_1 = require("./favorites/favorites.module.js");
const admin_module_js_1 = require("./admin/admin.module.js");
const common_module_js_1 = require("./common/common.module.js");
const app_controller_js_1 = require("./app.controller.js");
const app_service_js_1 = require("./app.service.js");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_js_1.default],
                validate: env_validation_js_1.validate,
                envFilePath: [
                    `.env.${process.env.NODE_ENV || 'development'}`,
                    '.env',
                ],
            }),
            mongoose_1.MongooseModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    uri: configService.get('mongodb.uri'),
                }),
            }),
            ioredis_1.RedisModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    type: 'single',
                    url: `redis://${configService.get('redis.host')}:${configService.get('redis.port')}/${configService.get('redis.db')}`,
                }),
            }),
            elasticsearch_1.ElasticsearchModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    const username = configService.get('elasticsearch.username');
                    const password = configService.get('elasticsearch.password');
                    return {
                        node: configService.get('elasticsearch.node'),
                        ...(username && password ? { auth: { username, password } } : {}),
                    };
                },
            }),
            throttler_1.ThrottlerModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    throttlers: [
                        {
                            ttl: configService.get('throttle.ttl') ?? 900000,
                            limit: configService.get('throttle.limit') ?? 10,
                        },
                    ],
                }),
            }),
            common_module_js_1.CommonModule,
            auth_module_js_1.AuthModule,
            users_module_js_1.UsersModule,
            categories_module_js_1.CategoriesModule,
            listings_module_js_1.ListingsModule,
            search_module_js_1.SearchModule,
            packages_module_js_1.PackagesModule,
            payments_module_js_1.PaymentsModule,
            messaging_module_js_1.MessagingModule,
            notifications_module_js_1.NotificationsModule,
            location_module_js_1.LocationModule,
            reviews_module_js_1.ReviewsModule,
            ai_module_js_1.AiModule,
            favorites_module_js_1.FavoritesModule,
            admin_module_js_1.AdminModule,
        ],
        controllers: [app_controller_js_1.AppController],
        providers: [app_service_js_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map