import { Injectable, Logger } from '@nestjs/common';
import { PushNotificationPayload } from './fcm.provider.js';

@Injectable()
export class HmsProvider {
  private readonly logger = new Logger(HmsProvider.name);

  async sendToDevice(
    deviceToken: string,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    // Stub: log instead of actually sending via Huawei Push Kit
    this.logger.log(
      `[HMS] Sending to ${deviceToken}: ${payload.title} - ${payload.body}`,
    );
    if (payload.data) {
      this.logger.debug(`[HMS] Data: ${JSON.stringify(payload.data)}`);
    }
    return true;
  }

  async sendToMultipleDevices(
    deviceTokens: string[],
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    this.logger.log(
      `[HMS] Sending to ${deviceTokens.length} devices: ${payload.title}`,
    );
    for (const token of deviceTokens) {
      await this.sendToDevice(token, payload);
    }
    return true;
  }
}
