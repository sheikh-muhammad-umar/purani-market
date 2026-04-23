import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { RedisModule } from '@nestjs-modules/ioredis';
import configuration from './config/configuration.js';
import { validate } from './config/env.validation.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { SearchModule } from './search/search.module.js';
import { PackagesModule } from './packages/packages.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { LocationModule } from './location/location.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { AiModule } from './ai/ai.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { AdminModule } from './admin/admin.module.js';
import { BrandsModule } from './brands/brands.module.js';
import { IdVerificationModule } from './id-verification/id-verification.module.js';
import { CommonModule } from './common/common.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),

    // MongoDB via Mongoose
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
      }),
    }),

    // Redis (caching, sessions, rate limiting)
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single' as const,
        url: `redis://${configService.get<string>('redis.host')}:${configService.get<number>('redis.port')}/${configService.get<number>('redis.db')}`,
      }),
    }),

    // Elasticsearch
    ElasticsearchModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const username = configService.get<string>('elasticsearch.username');
        const password = configService.get<string>('elasticsearch.password');
        return {
          node: configService.get<string>('elasticsearch.node'),
          ...(username && password ? { auth: { username, password } } : {}),
        };
      },
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('throttle.ttl') ?? 900000,
            limit: configService.get<number>('throttle.limit') ?? 10,
          },
        ],
      }),
    }),

    // Feature modules
    CommonModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ListingsModule,
    SearchModule,
    PackagesModule,
    PaymentsModule,
    MessagingModule,
    NotificationsModule,
    LocationModule,
    ReviewsModule,
    AiModule,
    FavoritesModule,
    AdminModule,
    BrandsModule,
    IdVerificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
