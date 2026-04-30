import { Routes } from '@angular/router';
import { sellerSeoResolver } from './core/resolvers/seo.resolver';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'listings',
    loadChildren: () =>
      import('./features/listings/listings.routes').then((m) => m.LISTINGS_ROUTES),
  },
  {
    path: 'seller/:id',
    loadComponent: () =>
      import('./features/seller-profile/seller-profile.component').then(
        (m) => m.SellerProfileComponent,
      ),
    resolve: { seo: sellerSeoResolver },
  },
  {
    path: 'search',
    loadChildren: () => import('./features/search/search.routes').then((m) => m.SEARCH_ROUTES),
  },
  {
    path: 'categories',
    loadChildren: () =>
      import('./features/categories/categories.routes').then((m) => m.CATEGORIES_ROUTES),
  },
  {
    path: 'messaging',
    loadChildren: () =>
      import('./features/messaging/messaging.routes').then((m) => m.MESSAGING_ROUTES),
  },
  {
    path: 'profile',
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: 'favorites',
    loadChildren: () =>
      import('./features/favorites/favorites.routes').then((m) => m.FAVORITES_ROUTES),
  },
  {
    path: 'packages',
    loadChildren: () =>
      import('./features/packages/packages.routes').then((m) => m.PACKAGES_ROUTES),
  },
  {
    path: 'reviews',
    loadChildren: () => import('./features/reviews/reviews.routes').then((m) => m.REVIEWS_ROUTES),
  },
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'pages',
    loadChildren: () => import('./features/pages/pages.routes').then((m) => m.PAGES_ROUTES),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
