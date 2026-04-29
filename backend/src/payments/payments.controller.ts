import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CardGateway } from './gateways/card.gateway.js';
import { PackagesService } from '../packages/packages.service.js';
import { PAYMENT_ROUTES, STRIPE_CHECKOUT_COMPLETED } from './constants.js';
import { PaymentMethod } from '../packages/schemas/package-purchase.schema.js';
import { ERROR } from '../common/constants/error-messages.js';

interface StripeWebhookEvent {
  type: string;
  data: { object: { id: string; payment_status: string } };
}

@Controller(PAYMENT_ROUTES.BASE)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly cardGateway: CardGateway,
    @Inject(forwardRef(() => PackagesService))
    private readonly packagesService: PackagesService,
  ) {}

  @Post(PAYMENT_ROUTES.STRIPE_WEBHOOK)
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
    @Res() res: any,
  ) {
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody) {
      this.logger.error('Stripe webhook: raw body not available');
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: ERROR.PAYMENT_RAW_BODY_REQUIRED });
    }

    let event: StripeWebhookEvent;
    try {
      event = this.cardGateway.verifyWebhookSignature(
        rawBody,
        signature,
      ) as StripeWebhookEvent;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown webhook error';
      this.logger.error(`Stripe webhook signature failed: ${message}`);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: `Webhook Error: ${message}` });
    }

    this.logger.log(`Stripe webhook received: ${event.type}`);

    if (event.type === STRIPE_CHECKOUT_COMPLETED) {
      const session = event.data.object;
      // Process payment directly instead of HTTP loopback
      this.packagesService
        .handlePaymentCallback({
          transactionId: session.id,
          paymentMethod: PaymentMethod.CARD,
        })
        .catch((err: Error) => {
          this.logger.error(
            `Failed to process Stripe payment ${session.id}: ${err.message}`,
          );
        });
    }

    return res.json({ received: true });
  }
}
