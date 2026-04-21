import { Routes } from '@angular/router';
import { authGuard, sellerGuard } from '../../core/auth';

export const LISTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./listing-list/listing-list.component').then((m) => m.ListingListComponent),
  },
  {
    path: 'create',
    canActivate: [sellerGuard],
    loadComponent: () =>
      import('./create-listing/create-listing.component').then((m) => m.CreateListingComponent),
  },
  {
    path: 'my',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./my-listings/my-listings.component').then((m) => m.MyListingsComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./listing-detail/listing-detail.component').then((m) => m.ListingDetailComponent),
  },
  {
    path: ':id/edit',
    canActivate: [sellerGuard],
    loadComponent: () =>
      import('./edit-listing/edit-listing.component').then((m) => m.EditListingComponent),
  },
];
