import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth';

export const REVIEWS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./review-list/review-list.component').then((m) => m.ReviewListComponent),
  },
  {
    path: 'write',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./write-review/write-review.component').then((m) => m.WriteReviewComponent),
  },
];
