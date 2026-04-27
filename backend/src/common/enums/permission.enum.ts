/** Granular permissions assignable to admin users by super_admin */
export enum Permission {
  // User management
  USERS_VIEW = 'users:view',
  USERS_ADD = 'users:add',
  USERS_EDIT = 'users:edit',
  USERS_DELETE = 'users:delete',
  USERS_SUSPEND = 'users:suspend',

  // Listing moderation
  LISTINGS_VIEW = 'listings:view',
  LISTINGS_APPROVE = 'listings:approve',
  LISTINGS_REJECT = 'listings:reject',
  LISTINGS_DELETE = 'listings:delete',

  // Categories
  CATEGORIES_VIEW = 'categories:view',
  CATEGORIES_ADD = 'categories:add',
  CATEGORIES_EDIT = 'categories:edit',
  CATEGORIES_DELETE = 'categories:delete',

  // Locations
  LOCATIONS_VIEW = 'locations:view',
  LOCATIONS_ADD = 'locations:add',
  LOCATIONS_EDIT = 'locations:edit',
  LOCATIONS_DELETE = 'locations:delete',

  // Packages & Payments
  PACKAGES_VIEW = 'packages:view',
  PACKAGES_ADD = 'packages:add',
  PACKAGES_EDIT = 'packages:edit',
  PAYMENTS_VIEW = 'payments:view',

  // Analytics
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',

  // Activity log
  ACTIVITY_VIEW = 'activity:view',

  // ID Verification
  ID_VERIFICATION_VIEW = 'id_verification:view',
  ID_VERIFICATION_REVIEW = 'id_verification:review',

  // Role management
  ROLES_MANAGE = 'roles:manage',
}
