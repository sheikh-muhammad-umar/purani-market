import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { JazzCashGateway } from './gateways/jazzcash.gateway.js';
import { EasyPaisaGateway } from './gateways/easypaisa.gateway.js';
import { CardGateway } from './gateways/card.gateway.js';
import { PackagesModule } from '../packages/packages.module.js';

const gateways = [JazzCashGateway, EasyPaisaGateway, CardGateway];

@Module({
  imports: [ConfigModule, forwardRef(() => PackagesModule)],
  controllers: [PaymentsController],
  providers: [PaymentsService, ...gateways],
  exports: [PaymentsService],
})
export class PaymentsModule {}
