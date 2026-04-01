declare enum Environment {
    Development = "development",
    Staging = "staging",
    Production = "production"
}
declare class EnvironmentVariables {
    NODE_ENV: Environment;
    PORT: number;
    MONGODB_URI: string;
    REDIS_HOST: string;
    REDIS_PORT: number;
    ELASTICSEARCH_NODE: string;
    JWT_SECRET: string;
}
export declare function validate(config: Record<string, unknown>): EnvironmentVariables;
export {};
