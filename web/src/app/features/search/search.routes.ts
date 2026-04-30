import { Routes } from '@angular/router';
import { searchSeoResolver } from '../../core/resolvers/seo.resolver';

export const SEARCH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./search-results/search-results.component').then((m) => m.SearchResultsComponent),
    resolve: { seo: searchSeoResolver },
  },
];
