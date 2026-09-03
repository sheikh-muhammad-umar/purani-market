import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { Report, ReportSchema } from './schemas/report.schema.js';
import { UsersModule } from '../users/users.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { SearchModule } from '../search/search.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
    UsersModule,
    ListingsModule, // StorageService + ProductListing model
    SearchModule, // SearchSyncService (pull deactivated listings from search)
    NotificationsModule, // NotificationsService
    AuthModule, // AuthService.invalidateAllSessions + EmailService
    forwardRef(() => AiModule), // AdminTrackerService
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
