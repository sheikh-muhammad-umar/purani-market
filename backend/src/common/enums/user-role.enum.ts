export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

/** Check whether a role string represents an admin-level role. */
export function isAdminRole(role?: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}
