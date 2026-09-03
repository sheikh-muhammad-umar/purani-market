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
        path: 'categories',
        loadComponent: () =>
          import('./categories/category-manager.component').then((m) => m.CategoryManagerComponent),
      },
      {
        path: 'advertising',
        children: [
          { path: '', redirectTo: 'campaigns', pathMatch: 'full' },
          {
            path: 'campaigns',
            loadComponent: () =>
              import('./advertising/ad-campaign-manager.component').then(
                (m) => m.AdCampaignManagerComponent,
              ),
          },
          {
            path: 'advertisers',
            loadComponent: () =>
              import('./advertising/advertiser-manager.component').then(
                (m) => m.AdvertiserManagerComponent,
              ),
          },
          {
            path: 'performance',
            loadComponent: () =>
              import('./advertising/ad-performance.component').then(
                (m) => m.AdPerformanceComponent,
              ),
          },
        ],
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
        children: [
          {
            path: '',
            redirectTo: 'listings',
            pathMatch: 'full',
          },
          {
            path: 'listings',
            loadComponent: () =>
              import('./packages/package-manager.component').then((m) => m.PackageManagerComponent),
          },
          {
            path: 'shorts',
            loadComponent: () =>
              import('./shorts-packages/shorts-packages-admin.component').then(
                (m) => m.ShortsPackagesAdminComponent,
              ),
          },
          {
            path: 'purchases',
            loadComponent: () =>
              import('./packages/purchases/package-purchases.component').then(
                (m) => m.PackagePurchasesComponent,
              ),
          },
        ],
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
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'reviews',
        loadComponent: () => import('./reviews/reviews.component').then((m) => m.ReviewsComponent),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./notifications/notification-manager.component').then(
            (m) => m.NotificationManagerComponent,
          ),
      },
      {
        path: 'experiments',
        loadComponent: () =>
          import('./experiments/experiments-dashboard.component').then(
            (m) => m.ExperimentsDashboardComponent,
          ),
      },
      {
        path: 'shorts',
        loadComponent: () =>
          import('./shorts/shorts-admin.component').then((m) => m.ShortsAdminComponent),
      },
      {
        path: 'analytics',
        children: [
          {
            path: '',
            redirectTo: 'listings',
            pathMatch: 'full',
          },
          {
            path: 'listings',
            loadComponent: () =>
              import('./analytics-listings/listings-analytics.component').then(
                (m) => m.ListingsAnalyticsComponent,
              ),
          },
          {
            path: 'shorts',
            loadComponent: () =>
              import('./shorts-analytics/shorts-analytics.component').then(
                (m) => m.ShortsAnalyticsComponent,
              ),
          },
          {
            path: 'users',
            loadComponent: () =>
              import('./analytics-users/users-analytics.component').then(
                (m) => m.UsersAnalyticsComponent,
              ),
          },
          {
            path: 'revenue',
            loadComponent: () =>
              import('./analytics-revenue/revenue-analytics.component').then(
                (m) => m.RevenueAnalyticsComponent,
              ),
          },
          {
            path: 'traffic',
            loadComponent: () =>
              import('./analytics-traffic/traffic-analytics.component').then(
                (m) => m.TrafficAnalyticsComponent,
              ),
          },
          {
            path: 'funnel',
            loadComponent: () =>
              import('./analytics-funnel/funnel-analytics.component').then(
                (m) => m.FunnelAnalyticsComponent,
              ),
          },
          {
            path: 'behaviour',
            loadComponent: () =>
              import('./analytics-behaviour/behaviour-analytics.component').then(
                (m) => m.BehaviourAnalyticsComponent,
              ),
          },
        ],
      },
    ],
  },
];
