import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth';

export const PACKAGES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./package-list/package-list.component').then(m => m.PackageListComponent),
  },
  {
    path: 'my',
    canActivate: [authGuard],
    loadComponent: () => import('./my-packages/my-packages.component').then(m => m.MyPackagesComponent),
  },
  {
    path: 'purchase/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./purchase-flow/purchase-flow.component').then(m => m.PurchaseFlowComponent),
  },
];
