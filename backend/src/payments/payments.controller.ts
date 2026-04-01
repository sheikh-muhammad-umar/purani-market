import { Controller } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';

@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
}
