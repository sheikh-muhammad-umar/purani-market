import { NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
export declare class CorsMiddleware implements NestMiddleware {
    private readonly configService;
    private readonly allowedOrigins;
    constructor(configService: ConfigService);
    use(req: Request, res: Response, next: NextFunction): void;
}
