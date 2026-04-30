import { Routes } from '@angular/router';
import { pageSeoResolver } from '../../core/resolvers/seo.resolver';

export const PAGES_ROUTES: Routes = [
  {
    path: 'about',
    loadComponent: () => import('./about/about.component').then((m) => m.AboutComponent),
    resolve: { seo: pageSeoResolver },
  },
  {
    path: 'careers',
    loadComponent: () => import('./careers/careers.component').then((m) => m.CareersComponent),
    resolve: { seo: pageSeoResolver },
  },
  {
    path: 'press',
    loadComponent: () => import('./press/press.component').then((m) => m.PressComponent),
    resolve: { seo: pageSeoResolver },
  },
  {
    path: 'trust-safety',
    loadComponent: () =>
      import('./trust-safety/trust-safety.component').then((m) => m.TrustSafetyComponent),
    resolve: { seo: pageSeoResolver },
  },
  {
    path: 'selling-tips',
    loadComponent: () =>
      import('./selling-tips/selling-tips.component').then((m) => m.SellingTipsComponent),
    resolve: { seo: pageSeoResolver },
  },
  {
    path: 'contact',
    loadComponent: () => import('./contact/contact.component').then((m) => m.ContactComponent),
    resolve: { seo: pageSeoResolver },
  },
  {
    path: 'terms',
    loadComponent: () => import('./terms/terms.component').then((m) => m.TermsComponent),
    resolve: { seo: pageSeoResolver },
  },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy/privacy.component').then((m) => m.PrivacyComponent),
    resolve: { seo: pageSeoResolver },
  },
  {
    path: 'cookies',
    loadComponent: () => import('./cookies/cookies.component').then((m) => m.CookiesComponent),
    resolve: { seo: pageSeoResolver },
  },
];
