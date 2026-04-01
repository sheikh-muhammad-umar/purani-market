import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth';

export const FAVORITES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./favorites-list/favorites-list.component').then(m => m.FavoritesListComponent),
  },
];
