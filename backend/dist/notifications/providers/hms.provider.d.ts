import { PushNotificationPayload } from './fcm.provider.js';
export declare class HmsProvider {
    private readonly logger;
    sendToDevice(deviceToken: string, payload: PushNotificationPayload): Promise<boolean>;
    sendToMultipleDevices(deviceTokens: string[], payload: PushNotificationPayload): Promise<boolean>;
}
