import { Routes } from '@angular/router';

export const SHORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shorts-feed/shorts-feed.component').then((m) => m.ShortsFeedComponent),
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./shorts-upload/shorts-upload.component').then((m) => m.ShortsUploadComponent),
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
