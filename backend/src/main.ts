import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module.js';
import { ApiKeyGuard } from './common/guards/api-key.guard.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Cookie parser
  app.use(cookieParser());

  // Global API key guard — all endpoints require X-API-Key header
  app.useGlobalGuards(new ApiKeyGuard(configService));

  // Serve uploaded files statically
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // CORS
  const allowedOrigins = configService.get<string>('cors.allowedOrigins') || '';
  const origins = allowedOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,X-CSRF-Token,X-API-Key',
    credentials: true,
  });

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);
}
bootstrap();
