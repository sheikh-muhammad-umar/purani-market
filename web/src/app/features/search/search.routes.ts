import { Routes } from '@angular/router';

export const SEARCH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./search-results/search-results.component').then((m) => m.SearchResultsComponent),
  },
];
