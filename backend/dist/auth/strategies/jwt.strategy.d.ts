import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import Redis from 'ioredis';
export interface JwtPayload {
    sub: string;
    email?: string;
    phone?: string;
    role: string;
    type: 'access' | 'refresh';
    jti: string;
}
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly redis;
    constructor(configService: ConfigService, redis: Redis);
    validate(req: any, payload: JwtPayload): Promise<JwtPayload>;
}
export {};
