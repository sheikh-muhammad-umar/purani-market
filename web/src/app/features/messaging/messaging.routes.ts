import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth';

export const MESSAGING_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./messaging-layout/messaging-layout.component').then(
        (m) => m.MessagingLayoutComponent,
      ),
  },
  {
    path: ':id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./messaging-layout/messaging-layout.component').then(
        (m) => m.MessagingLayoutComponent,
      ),
  },
];
