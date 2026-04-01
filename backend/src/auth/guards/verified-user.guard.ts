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

    // Check if user has verified their email (if registered with email)
    if (user.email && !user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email address to access this feature',
      );
    }

    // Check if user has verified their phone (if registered with phone)
    if (user.phone && !user.phoneVerified) {
      throw new ForbiddenException(
        'Please verify your phone number to access this feature',
      );
    }

    return true;
  }
}
