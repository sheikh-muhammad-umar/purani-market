import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that validates an X-API-Key header on public endpoints.
 * Prevents casual scraping — the key is embedded in the frontend app
 * so it's not truly secret, but stops direct URL access and simple bots.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const expectedKey = this.configService.get<string>('apiKey');

    if (!expectedKey) {
      // If no API key is configured, allow all requests
      return true;
    }

    if (!apiKey || apiKey !== expectedKey) {
      throw new ForbiddenException('Invalid API key');
    }

    return true;
  }
}
