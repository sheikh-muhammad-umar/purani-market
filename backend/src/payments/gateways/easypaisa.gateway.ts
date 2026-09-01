import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  PaymentGateway,
  PaymentInitResult,
  PaymentVerifyResult,
} from '../interfaces/payment-gateway.interface.js';
import {
  CONFIG_KEYS,
  EASYPAISA_AUTO_REDIRECT,
  EASYPAISA_HASH_ALGORITHM,
  EASYPAISA_INITIAL_PAYMENT_METHOD,
  EASYPAISA_ORDER_PREFIX,
  EASYPAISA_SUCCESS_CODES,
  EASYPAISA_UNSIGNED_FIELDS,
  TXN_EXPIRY_MS,
  TXN_REF_ENTROPY_CHARS,
} from '../constants.js';
import { randomRef } from '../random-ref.js';
import { ERROR } from '../../common/constants/error-messages.js';

interface EasyPaisaCallbackPayload {
  orderRefNumber?: string;
  orderRefNum?: string;
  transactionId?: string;
  status?: string;
  responseCode?: string;
  responseDesc?: string;
  responseMessage?: string;
  merchantHashedReq?: string;
  [key: string]: unknown;
}

@Injectable()
export class EasyPaisaGateway implements PaymentGateway {
  readonly name = 'easypaisa';
  private readonly logger = new Logger(EasyPaisaGateway.name);

  private readonly storeId: string;
  private readonly hashKey: string;
  private readonly allowUnsignedCallbacks: boolean;
  private readonly baseUrl: string;
  private readonly returnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.storeId =
      this.configService.get<string>(CONFIG_KEYS.EASYPAISA_STORE_ID) ?? '';
    // Compared against `true` rather than coerced: a stray truthy value reaching
    // config must not be enough to switch off signature verification.
    this.allowUnsignedCallbacks =
      this.configService.get<boolean>(CONFIG_KEYS.ALLOW_UNSIGNED_CALLBACKS) ===
      true;
    this.hashKey =
      this.configService.get<string>(CONFIG_KEYS.EASYPAISA_HASH_KEY) ?? '';
    this.baseUrl =
      this.configService.get<string>(CONFIG_KEYS.EASYPAISA_BASE_URL) ?? '';
    this.returnUrl =
      this.configService.get<string>(CONFIG_KEYS.EASYPAISA_RETURN_URL) ?? '';
  }

  async initiatePayment(params: {
    amount: number;
    currency: string;
    purchaseIds: string[];
    sellerId: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    // Random suffix so the reference cannot be guessed — see the note in the
    // JazzCash gateway.
    const orderId = `${EASYPAISA_ORDER_PREFIX}${Date.now()}${randomRef(TXN_REF_ENTROPY_CHARS)}`;
    const amount = params.amount.toFixed(1);
    const expiryDateStr = this.formatExpiryDate(
      new Date(Date.now() + TXN_EXPIRY_MS),
    );

    const payload = {
      storeId: this.storeId,
      amount,
      postBackURL: this.returnUrl,
      orderRefNum: orderId,
      expiryDate: expiryDateStr,
      autoRedirect: EASYPAISA_AUTO_REDIRECT,
      paymentMethod: EASYPAISA_INITIAL_PAYMENT_METHOD,
      emailAddr: '',
      mobileNum: '',
    };

    const hashString = [
      payload.amount,
      payload.autoRedirect,
      payload.emailAddr,
      payload.expiryDate,
      payload.mobileNum,
      payload.orderRefNum,
      payload.paymentMethod,
      payload.postBackURL,
      payload.storeId,
    ].join('&');

    const merchantHashedReq = createHmac(EASYPAISA_HASH_ALGORITHM, this.hashKey)
      .update(hashString)
      .digest('hex');

    const formParams = new URLSearchParams({
      ...payload,
      merchantHashedReq,
    });

    const redirectUrl = `${this.baseUrl}?${formParams.toString()}`;

    this.logger.log(
      `EasyPaisa payment initiated: ${orderId}, amount: ${amount}`,
    );

    return { transactionId: orderId, redirectUrl, status: 'initiated' };
  }

  async verifyCallback(
    payload: EasyPaisaCallbackPayload,
  ): Promise<PaymentVerifyResult> {
    const transactionId =
      payload.orderRefNumber ??
      payload.orderRefNum ??
      payload.transactionId ??
      '';
    const status = payload.status ?? payload.responseCode ?? '';

    // Refuse anything unsigned — see the same change in the JazzCash gateway.
    // Skipping verification when the hash was absent meant a hand-written POST
    // carrying a success status was enough to mark a purchase paid.
    if (!this.hashKey) {
      // Nothing can be verified without the secret. Refused rather than trusted,
      // unless a non-production environment has explicitly opted in — see
      // `allowUnsignedCallbacks`.
      if (this.allowUnsignedCallbacks) {
        this.logger.warn(
          `EasyPaisa callback accepted WITHOUT verification for ${transactionId} — ` +
            'allowUnsignedCallbacks is on. Never enable this outside local work.',
        );
        return this.resolveOutcome(payload, transactionId);
      }
      this.logger.error(
        `EasyPaisa signing secret is not configured — refusing callback ${transactionId}`,
      );
      return {
        transactionId,
        status: 'failed',
        reason: ERROR.PAYMENT_HASH_MISMATCH,
      };
    }

    if (!payload.merchantHashedReq) {
      this.logger.warn(
        `EasyPaisa callback without a hash for ${transactionId}`,
      );
      return {
        transactionId,
        status: 'failed',
        reason: ERROR.PAYMENT_HASH_MISMATCH,
      };
    }

    {
      const receivedHash = payload.merchantHashedReq;
      const hashPayload: Record<string, unknown> = { ...payload };
      delete hashPayload.merchantHashedReq;

      // The caller adds these before verification, and EasyPaisa never signed
      // them, so hashing them would guarantee a mismatch on a real callback.
      for (const field of EASYPAISA_UNSIGNED_FIELDS) delete hashPayload[field];

      const sortedValues = Object.keys(hashPayload)
        .sort()
        .map((k) => hashPayload[k])
        .join('&');

      const expectedHash = createHmac(EASYPAISA_HASH_ALGORITHM, this.hashKey)
        .update(sortedValues)
        .digest('hex');

      if (receivedHash !== expectedHash) {
        this.logger.warn(`EasyPaisa hash mismatch for ${transactionId}`);
        return {
          transactionId,
          status: 'failed',
          reason: ERROR.PAYMENT_HASH_MISMATCH,
        };
      }
    }

    return this.resolveOutcome(payload, transactionId);
  }

  /**
   * Reads the gateway's verdict off an already-verified payload.
   *
   * Split out so the unsigned-callback path cannot drift from the verified one.
   */
  private resolveOutcome(
    payload: EasyPaisaCallbackPayload,
    transactionId: string,
  ): PaymentVerifyResult {
    const status = payload.status ?? payload.responseCode ?? '';
    const isSuccess = (EASYPAISA_SUCCESS_CODES as readonly string[]).includes(
      status,
    );
    if (isSuccess) {
      this.logger.log(`EasyPaisa payment completed: ${transactionId}`);
      return { transactionId, status: 'completed' };
    }

    const reason =
      payload.responseDesc ??
      payload.responseMessage ??
      `EasyPaisa error: ${status}`;
    this.logger.warn(`EasyPaisa payment failed: ${transactionId} - ${reason}`);
    return { transactionId, status: 'failed', reason };
  }

  private formatExpiryDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}T${h}${min}${s}`;
  }
}
