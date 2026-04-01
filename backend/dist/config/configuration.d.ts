declare const _default: () => {
    nodeEnv: string;
    port: number;
    apiPrefix: string;
    mongodb: {
        uri: string;
    };
    redis: {
        host: string;
        port: number;
        password: string | undefined;
        db: number;
    };
    elasticsearch: {
        node: string;
        username: string | undefined;
        password: string | undefined;
    };
    jwt: {
        secret: string;
        accessExpiration: string;
        refreshExpiration: string;
    };
    throttle: {
        ttl: number;
        limit: number;
    };
    cors: {
        allowedOrigins: string;
    };
    google: {
        clientId: string;
        mapsApiKey: string;
    };
    facebook: {
        appId: string;
        appSecret: string;
    };
};
export default _default;
