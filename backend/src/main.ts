import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
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
