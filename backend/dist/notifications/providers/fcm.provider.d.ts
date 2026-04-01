export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}
export declare class FcmProvider {
    private readonly logger;
    sendToDevice(deviceToken: string, payload: PushNotificationPayload): Promise<boolean>;
    sendToMultipleDevices(deviceTokens: string[], payload: PushNotificationPayload): Promise<boolean>;
}
