import { Routes } from '@angular/router';
import { shortSeoResolver } from '../../core/resolvers/seo.resolver';

export const SHORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shorts-feed/shorts-feed.component').then((m) => m.ShortsFeedComponent),
    // Re-run SEO resolution when the ?id= query param changes so opening a
    // specific short updates title/OG/video meta without a full navigation.
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    resolve: { seo: shortSeoResolver },
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./shorts-upload/shorts-upload.component').then((m) => m.ShortsUploadComponent),
  },
  {
    path: 'packages',
    loadComponent: () =>
      import('./shorts-packages/shorts-packages.component').then((m) => m.ShortsPackagesComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./shorts-edit/shorts-edit.component').then((m) => m.ShortsEditComponent),
  },
  {
    path: 'my',
    redirectTo: '/listings/my?tab=shorts',
    pathMatch: 'full',
  },
];
