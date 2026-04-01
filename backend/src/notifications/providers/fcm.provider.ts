import { Injectable, Logger } from '@nestjs/common';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmProvider {
  private readonly logger = new Logger(FcmProvider.name);

  async sendToDevice(
    deviceToken: string,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    // Stub: log instead of actually sending via Firebase Cloud Messaging
    this.logger.log(
      `[FCM] Sending to ${deviceToken}: ${payload.title} - ${payload.body}`,
    );
    if (payload.data) {
      this.logger.debug(`[FCM] Data: ${JSON.stringify(payload.data)}`);
    }
    return true;
  }

  async sendToMultipleDevices(
    deviceTokens: string[],
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    this.logger.log(
      `[FCM] Sending to ${deviceTokens.length} devices: ${payload.title}`,
    );
    for (const token of deviceTokens) {
      await this.sendToDevice(token, payload);
    }
    return true;
  }
}
