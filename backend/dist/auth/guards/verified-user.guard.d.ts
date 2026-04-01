import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class VerifiedUserGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
