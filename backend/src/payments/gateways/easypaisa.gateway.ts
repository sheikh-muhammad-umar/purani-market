import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  PaymentGateway,
  PaymentInitResult,
  PaymentVerifyResult,
} from '../interfaces/payment-gateway.interface.js';
import {
  EASYPAISA_SUCCESS_CODES,
  EASYPAISA_ORDER_PREFIX,
  EASYPAISA_AUTO_REDIRECT,
  EASYPAISA_INITIAL_PAYMENT_METHOD,
  EASYPAISA_HASH_ALGORITHM,
  TXN_EXPIRY_MS,
  CONFIG_KEYS,
} from '../constants.js';
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
  private readonly baseUrl: string;
  private readonly returnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.storeId =
      this.configService.get<string>(CONFIG_KEYS.EASYPAISA_STORE_ID) ?? '';
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
    const orderId = `${EASYPAISA_ORDER_PREFIX}${Date.now()}`;
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

    if (payload.merchantHashedReq && this.hashKey) {
      const receivedHash = payload.merchantHashedReq;
      const hashPayload = { ...payload };
      delete hashPayload.merchantHashedReq;

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
