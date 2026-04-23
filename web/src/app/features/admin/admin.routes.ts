import { Routes } from '@angular/router';
import { adminGuard } from '../../core/auth';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./dashboard/analytics-dashboard.component').then(
            (m) => m.AnalyticsDashboardComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./users/user-management.component').then((m) => m.UserManagementComponent),
      },
      {
        path: 'listings',
        loadComponent: () =>
          import('./all-listings/all-listings.component').then((m) => m.AllListingsComponent),
      },
      {
        path: 'moderation',
        loadComponent: () =>
          import('./listings/moderation-queue.component').then((m) => m.ModerationQueueComponent),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./categories/category-manager.component').then((m) => m.CategoryManagerComponent),
      },
      {
        path: 'brands',
        loadComponent: () =>
          import('./brands/brand-manager.component').then((m) => m.BrandManagerComponent),
      },
      {
        path: 'vehicles',
        loadComponent: () =>
          import('./vehicles/vehicle-manager.component').then((m) => m.VehicleManagerComponent),
      },
      {
        path: 'packages',
        loadComponent: () =>
          import('./packages/package-manager.component').then((m) => m.PackageManagerComponent),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./payments/payment-transactions.component').then(
            (m) => m.PaymentTransactionsComponent,
          ),
      },
      {
        path: 'locations',
        loadComponent: () =>
          import('./locations/location-manager.component').then((m) => m.LocationManagerComponent),
      },
      {
        path: 'activity',
        loadComponent: () =>
          import('./activity/user-activity.component').then((m) => m.UserActivityComponent),
      },
      {
        path: 'rejection-reasons',
        loadComponent: () =>
          import('./rejection-reasons/rejection-reasons.component').then(
            (m) => m.RejectionReasonsComponent,
          ),
      },
      {
        path: 'deletion-reasons',
        loadComponent: () =>
          import('./deletion-reasons/deletion-reasons.component').then(
            (m) => m.DeletionReasonsComponent,
          ),
      },
      {
        path: 'id-verifications',
        loadComponent: () =>
          import('./id-verifications/id-verifications.component').then(
            (m) => m.IdVerificationsComponent,
          ),
      },
    ],
  },
];
