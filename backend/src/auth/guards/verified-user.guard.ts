import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class VerifiedUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // emailVerified is always fetched fresh from DB by JwtStrategy.validate()
    // so we only need to check that flag — not user.email from the token,
    // which may be stale if the email was added/changed after the token was issued.
    if (user.emailVerified === false) {
      throw new ForbiddenException(
        'Please verify your email address to access this feature',
      );
    }

    return true;
  }
}
