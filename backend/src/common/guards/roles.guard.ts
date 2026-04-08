import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied: not authenticated');
    }

    // Try multiple ways to get the role (JWT payload or populated user)
    const role = user.role || user.userRole;

    if (!role) {
      throw new ForbiddenException('Access denied: no role assigned. Please log out and log back in.');
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException(
        'Access denied: insufficient permissions',
      );
    }

    return true;
  }
}
