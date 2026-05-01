import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard that requires the user to have a verified phone number.
 * Used on endpoints where phone verification is mandatory (e.g. posting listings).
 */
@Injectable()
export class PhoneVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (user.phone && !user.phoneVerified) {
      throw new ForbiddenException(
        'Please verify your phone number to access this feature',
      );
    }

    return true;
  }
}
