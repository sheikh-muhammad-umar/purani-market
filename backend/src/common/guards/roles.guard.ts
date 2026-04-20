import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No role or permission requirement — allow
    if ((!requiredRoles || requiredRoles.length === 0) && (!requiredPermissions || requiredPermissions.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied: not authenticated');
    }

    const role = user.role || user.userRole;
    if (!role) {
      throw new ForbiddenException('Access denied: no role assigned');
    }

    // super_admin has full access to everything
    if (role === 'super_admin') {
      return true;
    }

    // Check role requirement
    if (requiredRoles && requiredRoles.length > 0) {
      // Allow if user's role is in the required list, OR if 'admin' is required and user is super_admin
      if (!requiredRoles.includes(role)) {
        throw new ForbiddenException('Access denied: insufficient role');
      }
    }

    // Check permission requirement (for admin users with granular permissions)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions: string[] = user.permissions || [];
      const hasAll = requiredPermissions.every(p => userPermissions.includes(p));
      if (!hasAll) {
        throw new ForbiddenException('Access denied: missing required permissions');
      }
    }

    return true;
  }
}
