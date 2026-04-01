import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { JazzCashGateway } from './gateways/jazzcash.gateway.js';
import { EasyPaisaGateway } from './gateways/easypaisa.gateway.js';
import { CardGateway } from './gateways/card.gateway.js';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, JazzCashGateway, EasyPaisaGateway, CardGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
