import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_ROUTES, PACKAGE_ROUTES } from '../../payments/constants.js';

/**
 * Guard that validates an X-API-Key header on public endpoints.
 * Prevents casual scraping — the key is embedded in the frontend app
 * so it's not truly secret, but stops direct URL access and simple bots.
 *
 * Payment callback endpoints are excluded since external providers
 * (JazzCash, EasyPaisa, Stripe) POST to them directly.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private static readonly EXCLUDED_PATHS: readonly string[] = [
    `/${PAYMENT_ROUTES.BASE}/${PAYMENT_ROUTES.STRIPE_WEBHOOK}`,
    `/${PACKAGE_ROUTES.BASE}/${PACKAGE_ROUTES.PAYMENT_CALLBACK}`,
  ];

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      url?: string;
      headers: Record<string, string | undefined>;
    }>();

    const path = request.url?.split('?')[0] ?? '';
    if (ApiKeyGuard.EXCLUDED_PATHS.includes(path)) {
      return true;
    }

    const expectedKey = this.configService.get<string>('apiKey');
    if (!expectedKey) {
      return true;
    }

    const apiKey = request.headers['x-api-key'];
    if (!apiKey || apiKey !== expectedKey) {
      throw new ForbiddenException('Invalid API key');
    }

    return true;
  }
}
