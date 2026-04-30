import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

import type { Request, Response as ExpressResponse } from 'express';
import { logSsrError, injectNoindexAndSend, sendFallbackShell } from './ssr-error-handler';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Read the client-side shell HTML once at startup.
 * This is the fallback returned when SSR rendering fails.
 */
let shellHtml: string;
try {
  shellHtml = readFileSync(join(browserDistFolder, 'index.csr.html'), 'utf-8');
} catch {
  try {
    shellHtml = readFileSync(join(browserDistFolder, 'index.html'), 'utf-8');
  } catch {
    shellHtml = `<!doctype html><html><head><title>${process.env['SEO_SITE_NAME'] || 'marketplace.pk'}</title></head><body><app-root></app-root></body></html>`;
  }
}

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 * On success, write the SSR response. If the Angular engine returns
 * a 404 status, inject a noindex meta tag so search engines skip the page.
 * On failure, fall back to the client-side shell HTML with a 200 status.
 */
app.use('*path', (req: Request, res: ExpressResponse) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (!response) {
        // No SSR response — serve the client-side shell so the SPA can bootstrap
        sendFallbackShell(res, shellHtml);
        return;
      }

      // If the Angular SSR engine returned a 404, inject noindex meta tag
      if (response.status === 404) {
        injectNoindexAndSend(response, res, shellHtml);
        return;
      }

      writeResponseToNodeResponse(response, res);
    })
    .catch((err: unknown) => {
      logSsrError(err, req);
      sendFallbackShell(res, shellHtml);
    });
});

/**
 * Start the server if this module is the main entry point.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * The request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createNodeRequestHandler(app);
