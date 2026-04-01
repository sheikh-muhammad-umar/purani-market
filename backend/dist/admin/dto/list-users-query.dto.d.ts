import { UserRole, UserStatus } from '../../users/schemas/user.schema.js';
export declare class ListUsersQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    status?: UserStatus;
    registeredFrom?: string;
    registeredTo?: string;
}
