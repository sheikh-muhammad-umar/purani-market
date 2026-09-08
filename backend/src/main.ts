import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module.js';
import { ApiKeyGuard } from './common/guards/api-key.guard.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Express 5 changed the default query parser from 'extended' to 'simple',
  // which stops parsing bracket notation into nested objects. That silently
  // broke every category attribute filter: `filters[make]=Toyota` arrived as a
  // literal key named "filters[make]", which the global forbidNonWhitelisted
  // ValidationPipe then rejected with a 400. Restoring 'extended' lets the
  // whitelisted `filters` object on SearchQueryDto be populated again, and is
  // what SearchService.buildCategoryFilters already expects (it reads
  // `{ min, max }` objects for range/number and arrays for multiselect).
  app.set('query parser', 'extended');

  const configService = app.get(ConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          frameSrc: ["'self'", 'https://maps.google.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        },
      },
      crossOriginEmbedderPolicy: false, // needed for map embeds
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow cross-origin image/media loads
    }),
  );
  app.disable('x-powered-by');

  /**
   * Compress responses.
   *
   * The API returns uncompressed JSON, which is invisible on localhost and
   * expensive over a real network: measured, gzip cuts /api/categories from
   * 78,560 to 11,968 bytes (85%) and a search page from 25,146 to 2,693 (89%),
   * taking projected peak egress from ~1,291 to ~240 Mbit/s.
   *
   * The 1KB threshold matters -- below it compression can make a response
   * larger. The 96-byte inherited-attributes payload grows to 109 bytes when
   * gzipped, so small responses are deliberately left alone.
   */
  app.use(
    compression({
      threshold: 1024,
      /**
       * Level 4 rather than zlib's default 6.
       *
       * Measured on this API's actual payloads: on the 78KB category tree, level
       * 6 costs 0.666ms of CPU per response against level 4's 0.414ms -- 61% more
       * CPU to produce output only 5.1% smaller. Since the process is already
       * CPU-bound on a single core, that trade is the wrong way round; at ~1000
       * rps it is the difference between roughly 66% and 41% of a core spent
       * compressing one endpoint. On small payloads the two levels are within a
       * few bytes and a few microseconds of each other, so nothing is lost there.
       */
      level: 4,
      // Skip when the client explicitly asks us not to, so Server-Sent Events
      // and similar streaming responses are not buffered by the compressor.
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
    }),
  );

  app.use(cookieParser());
  app.useGlobalGuards(new ApiKeyGuard(configService));
  // Serve uploaded files. Files use UUID-prefixed names making URLs unguessable.
  // For production, consider serving via a CDN with signed URLs instead.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const allowedOrigins = configService.get<string>('cors.allowedOrigins') ?? '';
  const origins = allowedOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || origins.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,X-CSRF-Token,X-API-Key',
    exposedHeaders: ['X-CSRF-Token'],
    credentials: true,
    maxAge: 86400, // cache preflight for 24 hours
  });

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);
}
bootstrap();
