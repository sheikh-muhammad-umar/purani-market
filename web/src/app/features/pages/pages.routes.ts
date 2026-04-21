import { Routes } from '@angular/router';

export const PAGES_ROUTES: Routes = [
  {
    path: 'about',
    loadComponent: () => import('./about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'careers',
    loadComponent: () => import('./careers/careers.component').then((m) => m.CareersComponent),
  },
  {
    path: 'press',
    loadComponent: () => import('./press/press.component').then((m) => m.PressComponent),
  },
  {
    path: 'trust-safety',
    loadComponent: () =>
      import('./trust-safety/trust-safety.component').then((m) => m.TrustSafetyComponent),
  },
  {
    path: 'selling-tips',
    loadComponent: () =>
      import('./selling-tips/selling-tips.component').then((m) => m.SellingTipsComponent),
  },
  {
    path: 'contact',
    loadComponent: () => import('./contact/contact.component').then((m) => m.ContactComponent),
  },
  {
    path: 'terms',
    loadComponent: () => import('./terms/terms.component').then((m) => m.TermsComponent),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'cookies',
    loadComponent: () => import('./cookies/cookies.component').then((m) => m.CookiesComponent),
  },
];
