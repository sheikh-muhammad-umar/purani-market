import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentGateway,
  PaymentInitResult,
  PaymentVerifyResult,
} from '../interfaces/payment-gateway.interface.js';
import {
  STRIPE_CHECKOUT_COMPLETED,
  STRIPE_PAYMENT_STATUS_PAID,
  STRIPE_PRODUCT_NAME,
  AMOUNT_MULTIPLIER,
  CONFIG_KEYS,
} from '../constants.js';
import { ERROR } from '../../common/constants/error-messages.js';

interface StripeWebhookPayload {
  type: string;
  data: { object: { id: string; payment_status: string } };
}

interface StripeCallbackPayload {
  type?: string;
  data?: { object: { id: string; payment_status: string } };
  session_id?: string;
  transactionId?: string;
  [key: string]: unknown;
}

@Injectable()
export class CardGateway implements PaymentGateway {
  readonly name = 'card';
  private readonly logger = new Logger(CardGateway.name);
  private stripe: InstanceType<typeof Stripe> | null = null;
  private readonly webhookSecret: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey =
      this.configService.get<string>(CONFIG_KEYS.STRIPE_SECRET_KEY) ?? '';
    this.webhookSecret =
      this.configService.get<string>(CONFIG_KEYS.STRIPE_WEBHOOK_SECRET) ?? '';
    this.successUrl =
      this.configService.get<string>(CONFIG_KEYS.STRIPE_SUCCESS_URL) ?? '';
    this.cancelUrl =
      this.configService.get<string>(CONFIG_KEYS.STRIPE_CANCEL_URL) ?? '';

    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set — card payments will be unavailable',
      );
    }
  }

  private getStripe(): InstanceType<typeof Stripe> {
    if (!this.stripe) {
      throw new BadRequestException(ERROR.PAYMENT_STRIPE_NOT_CONFIGURED);
    }
    return this.stripe;
  }

  async initiatePayment(params: {
    amount: number;
    currency: string;
    purchaseIds: string[];
    sellerId: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    const stripe = this.getStripe();
    const amountInSmallestUnit = Math.round(params.amount * AMOUNT_MULTIPLIER);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: STRIPE_PRODUCT_NAME,
              description: `Purchase IDs: ${params.purchaseIds.join(', ')}`,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      metadata: {
        purchaseIds: params.purchaseIds.join(','),
        sellerId: params.sellerId,
      },
      success_url: this.successUrl,
      cancel_url: this.cancelUrl,
    });

    this.logger.log(`Stripe checkout session created: ${session.id}`);

    return {
      transactionId: session.id,
      redirectUrl: session.url ?? '',
      status: 'initiated',
    };
  }

  async verifyCallback(
    payload: StripeCallbackPayload,
  ): Promise<PaymentVerifyResult> {
    if (payload.type && payload.data?.object) {
      return this.handleWebhookEvent(payload as StripeWebhookPayload);
    }

    const sessionId = payload.session_id ?? payload.transactionId ?? '';
    if (!sessionId) {
      return {
        transactionId: '',
        status: 'failed',
        reason: 'No session ID or webhook event provided',
      };
    }

    try {
      const stripe = this.getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === STRIPE_PAYMENT_STATUS_PAID) {
        this.logger.log(`Stripe payment completed: ${sessionId}`);
        return { transactionId: sessionId, status: 'completed' };
      }
      return {
        transactionId: sessionId,
        status: 'failed',
        reason: `Payment status: ${session.payment_status}`,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown Stripe error';
      this.logger.error(`Stripe session retrieve error: ${message}`);
      return { transactionId: sessionId, status: 'failed', reason: message };
    }
  }

  private handleWebhookEvent(event: StripeWebhookPayload): PaymentVerifyResult {
    const session = event.data.object;

    if (
      event.type === STRIPE_CHECKOUT_COMPLETED &&
      session.payment_status === STRIPE_PAYMENT_STATUS_PAID
    ) {
      this.logger.log(`Stripe webhook: payment completed for ${session.id}`);
      return { transactionId: session.id, status: 'completed' };
    }

    return {
      transactionId: session.id,
      status: 'failed',
      reason: `Webhook event: ${event.type}, status: ${session.payment_status}`,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): unknown {
    const stripe = this.getStripe();
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }
}
