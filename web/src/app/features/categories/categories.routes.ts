import { Routes } from '@angular/router';
import { categorySeoResolver } from '../../core/resolvers/seo.resolver';
export const CATEGORIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./category-browse/category-browse.component').then((m) => m.CategoryBrowseComponent),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./category-listings/category-listings.component').then(
        (m) => m.CategoryListingsComponent,
      ),
    resolve: { seo: categorySeoResolver },
  },
];
