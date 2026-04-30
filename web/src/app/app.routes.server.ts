import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Prerendered routes — static HTML generated at build time for instant loading
  // Home page (refreshed every 1 hour via backend scheduled task)
  { path: '', renderMode: RenderMode.Prerender },

  // Static pages (refreshed every 24 hours via backend scheduled task)
  { path: 'pages/about', renderMode: RenderMode.Prerender },
  { path: 'pages/terms', renderMode: RenderMode.Prerender },
  { path: 'pages/privacy', renderMode: RenderMode.Prerender },
  { path: 'pages/contact', renderMode: RenderMode.Prerender },
  { path: 'pages/careers', renderMode: RenderMode.Prerender },
  { path: 'pages/press', renderMode: RenderMode.Prerender },
  { path: 'pages/trust-safety', renderMode: RenderMode.Prerender },
  { path: 'pages/selling-tips', renderMode: RenderMode.Prerender },
  { path: 'pages/cookies', renderMode: RenderMode.Prerender },

  // Public routes — rendered on the server for SEO (on-demand SSR)
  { path: 'listings/**', renderMode: RenderMode.Server },
  { path: 'categories/**', renderMode: RenderMode.Server },
  { path: 'search/**', renderMode: RenderMode.Server },
  { path: 'seller/**', renderMode: RenderMode.Server },
  { path: 'pages/**', renderMode: RenderMode.Server },

  // Private routes — client-only, no SSR needed
  { path: 'profile/**', renderMode: RenderMode.Client },
  { path: 'favorites/**', renderMode: RenderMode.Client },
  { path: 'messaging/**', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'auth/**', renderMode: RenderMode.Client },
  { path: 'packages/**', renderMode: RenderMode.Client },
  { path: 'reviews/**', renderMode: RenderMode.Client },

  // Fallback — client-side rendering for any unmatched routes
  { path: '**', renderMode: RenderMode.Client },
];
