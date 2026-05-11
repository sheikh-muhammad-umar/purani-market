import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard that requires the user to have a verified phone number.
 * Used on endpoints where phone verification is mandatory (e.g. posting listings).
 * Blocks both: users with no phone, and users with an unverified phone.
 */
@Injectable()
export class PhoneVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // phoneVerified is always fetched fresh from DB by JwtStrategy.validate()
    // so we only need to check that flag — not user.phone from the token,
    // which may be stale if the phone was added after the token was issued.
    if (!user.phoneVerified) {
      throw new ForbiddenException(
        'Please verify your phone number to access this feature',
      );
    }

    return true;
  }
}
