import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  PaymentGateway,
  PaymentInitResult,
  PaymentVerifyResult,
} from '../interfaces/payment-gateway.interface.js';
import {
  AMOUNT_MULTIPLIER,
  CONFIG_KEYS,
  JAZZCASH_API_VERSION,
  JAZZCASH_CURRENCY,
  JAZZCASH_HASHED_FIELD_PATTERN,
  JAZZCASH_HASH_ALGORITHM,
  JAZZCASH_LANGUAGE,
  JAZZCASH_SUCCESS_CODE,
  JAZZCASH_TXN_REF_PREFIX,
  TXN_EXPIRY_MS,
  TXN_REF_ENTROPY_CHARS,
} from '../constants.js';
import { randomRef } from '../random-ref.js';
import { ERROR } from '../../common/constants/error-messages.js';

interface JazzCashPayload {
  pp_Version: string;
  pp_TxnType: string;
  pp_Language: string;
  pp_MerchantID: string;
  pp_SubMerchantID: string;
  pp_Password: string;
  pp_BankID: string;
  pp_ProductID: string;
  pp_TxnRefNo: string;
  pp_Amount: string;
  pp_TxnCurrency: string;
  pp_TxnDateTime: string;
  pp_BillReference: string;
  pp_Description: string;
  pp_TxnExpiryDateTime: string;
  pp_ReturnURL: string;
  pp_SecureHash?: string;
  ppmpf_1: string;
  ppmpf_2: string;
  ppmpf_3: string;
  ppmpf_4: string;
  ppmpf_5: string;
}

interface JazzCashCallbackPayload {
  pp_TxnRefNo?: string;
  transactionId?: string;
  pp_ResponseCode?: string;
  pp_ResponseMessage?: string;
  pp_SecureHash?: string;
  [key: string]: unknown;
}

@Injectable()
export class JazzCashGateway implements PaymentGateway {
  readonly name = 'jazzcash';
  private readonly logger = new Logger(JazzCashGateway.name);

  private readonly merchantId: string;
  private readonly password: string;
  private readonly integritySalt: string;
  private readonly allowUnsignedCallbacks: boolean;
  private readonly baseUrl: string;
  private readonly returnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.merchantId =
      this.configService.get<string>(CONFIG_KEYS.JAZZCASH_MERCHANT_ID) ?? '';
    this.password =
      this.configService.get<string>(CONFIG_KEYS.JAZZCASH_PASSWORD) ?? '';
    // Compared against `true` rather than coerced: a stray truthy value reaching
    // config must not be enough to switch off signature verification.
    this.allowUnsignedCallbacks =
      this.configService.get<boolean>(CONFIG_KEYS.ALLOW_UNSIGNED_CALLBACKS) ===
      true;
    this.integritySalt =
      this.configService.get<string>(CONFIG_KEYS.JAZZCASH_INTEGRITY_SALT) ?? '';
    this.baseUrl =
      this.configService.get<string>(CONFIG_KEYS.JAZZCASH_BASE_URL) ?? '';
    this.returnUrl =
      this.configService.get<string>(CONFIG_KEYS.JAZZCASH_RETURN_URL) ?? '';
  }

  async initiatePayment(params: {
    amount: number;
    currency: string;
    purchaseIds: string[];
    sellerId: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    const now = new Date();
    const txnDateTime = this.formatDate(now);
    const txnExpiryDateTime = this.formatDate(
      new Date(now.getTime() + TXN_EXPIRY_MS),
    );
    // Timestamp plus random suffix.
    //
    // A bare `T` + YYYYMMDDHHmmss is guessable: the whole space for a given day is
    // 86,400 values. Anyone able to guess a reference could aim a forged callback
    // at it, so the reference itself should not be the only thing standing in the
    // way. JazzCash allows 20 characters for pp_TxnRefNo, and prefix + timestamp
    // uses 15, so the remaining 5 carry the entropy.
    const txnRefNo = `${JAZZCASH_TXN_REF_PREFIX}${txnDateTime}${randomRef(TXN_REF_ENTROPY_CHARS)}`;
    const amountInPaisa = String(Math.round(params.amount * AMOUNT_MULTIPLIER));

    const payload: JazzCashPayload = {
      pp_Version: JAZZCASH_API_VERSION,
      pp_TxnType: '',
      pp_Language: JAZZCASH_LANGUAGE,
      pp_MerchantID: this.merchantId,
      pp_SubMerchantID: '',
      pp_Password: this.password,
      pp_BankID: '',
      pp_ProductID: '',
      pp_TxnRefNo: txnRefNo,
      pp_Amount: amountInPaisa,
      pp_TxnCurrency: JAZZCASH_CURRENCY,
      pp_TxnDateTime: txnDateTime,
      pp_BillReference: params.purchaseIds.join(','),
      pp_Description: `Package purchase by ${params.sellerId}`,
      pp_TxnExpiryDateTime: txnExpiryDateTime,
      pp_ReturnURL: this.returnUrl,
      ppmpf_1: '',
      ppmpf_2: '',
      ppmpf_3: '',
      ppmpf_4: '',
      ppmpf_5: '',
    };

    const hashablePayload: Record<string, string> = { ...payload };
    hashablePayload.pp_SecureHash = this.generateSecureHash(hashablePayload);

    const redirectUrl = `${this.baseUrl}?${new URLSearchParams(hashablePayload).toString()}`;

    this.logger.log(
      `JazzCash payment initiated: ${txnRefNo}, amount: ${amountInPaisa}`,
    );

    return { transactionId: txnRefNo, redirectUrl, status: 'initiated' };
  }

  async verifyCallback(
    payload: JazzCashCallbackPayload,
  ): Promise<PaymentVerifyResult> {
    const transactionId = payload.pp_TxnRefNo ?? payload.transactionId ?? '';
    const responseCode = payload.pp_ResponseCode ?? '';
    const receivedHash = payload.pp_SecureHash ?? '';

    // Refuse anything unsigned.
    //
    // This used to skip verification when the hash was absent and then accept the
    // caller's own response code, so a POST of
    // `{pp_TxnRefNo, pp_ResponseCode: '000'}` marked a purchase paid. The callback
    // route is deliberately outside the API-key guard so gateways can reach it,
    // which left that open to anyone.
    if (!this.integritySalt) {
      // Nothing can be verified without the secret. Refused rather than trusted,
      // unless a non-production environment has explicitly opted in — see
      // `allowUnsignedCallbacks`.
      if (this.allowUnsignedCallbacks) {
        this.logger.warn(
          `JazzCash callback accepted WITHOUT verification for ${transactionId} — ` +
            'allowUnsignedCallbacks is on. Never enable this outside local work.',
        );
        return this.resolveOutcome(payload, transactionId);
      }
      this.logger.error(
        `JazzCash signing secret is not configured — refusing callback ${transactionId}`,
      );
      return {
        transactionId,
        status: 'failed',
        reason: ERROR.PAYMENT_HASH_MISMATCH,
      };
    }

    if (!receivedHash) {
      this.logger.warn(
        `JazzCash callback without a secure hash for ${transactionId}`,
      );
      return {
        transactionId,
        status: 'failed',
        reason: ERROR.PAYMENT_HASH_MISMATCH,
      };
    }

    {
      const hashPayload: Record<string, string> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (k === 'pp_SecureHash') continue;

        // Only JazzCash's own parameters take part in the hash.
        //
        // The caller adds fields before verification — `transactionId`, and
        // `paymentMethod` from the request body — and hashing those made the
        // computed digest cover data JazzCash never signed, so it could not match
        // a genuine callback. That went unnoticed because verification was skipped
        // whenever the hash was absent, which is the case for the sandbox return
        // URL. Restricting to the documented prefixes is what makes refusing
        // unsigned callbacks safe rather than an outage.
        if (!JAZZCASH_HASHED_FIELD_PATTERN.test(k)) continue;

        // The payload is an index signature over `unknown`, while a genuine
        // callback is form-encoded primitives. Coercing a nested value here
        // would hash the literal "[object Object]", so the comparison below
        // would fail with nothing in the logs to explain why. Treat it as the
        // malformed callback it is instead.
        if (v === null || v === undefined) {
          hashPayload[k] = '';
        } else if (
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean'
        ) {
          hashPayload[k] = String(v);
        } else {
          this.logger.warn(
            `JazzCash callback field ${k} was not a primitive for ${transactionId}`,
          );
          return {
            transactionId,
            status: 'failed',
            reason: ERROR.PAYMENT_HASH_MISMATCH,
          };
        }
      }
      const expectedHash = this.generateSecureHash(hashPayload);
      if (receivedHash !== expectedHash) {
        this.logger.warn(`JazzCash hash mismatch for ${transactionId}`);
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
    payload: JazzCashCallbackPayload,
    transactionId: string,
  ): PaymentVerifyResult {
    const responseCode = payload.pp_ResponseCode ?? '';

    if (responseCode === JAZZCASH_SUCCESS_CODE) {
      this.logger.log(`JazzCash payment completed: ${transactionId}`);
      return { transactionId, status: 'completed' };
    }

    const reason =
      payload.pp_ResponseMessage ?? `JazzCash error code: ${responseCode}`;
    this.logger.warn(`JazzCash payment failed: ${transactionId} - ${reason}`);
    return { transactionId, status: 'failed', reason };
  }

  private generateSecureHash(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params)
      .filter((k) => k !== 'pp_SecureHash' && params[k] !== '')
      .sort();

    const hashString =
      this.integritySalt + '&' + sortedKeys.map((k) => params[k]).join('&');

    return createHmac(JAZZCASH_HASH_ALGORITHM, this.integritySalt)
      .update(hashString)
      .digest('hex')
      .toUpperCase();
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}${h}${min}${s}`;
  }
}
