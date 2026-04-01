export declare enum SocialProvider {
    GOOGLE = "google",
    FACEBOOK = "facebook"
}
export declare class SocialLoginDto {
    provider: SocialProvider;
    token: string;
}
