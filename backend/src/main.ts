import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module.js';
import { ApiKeyGuard } from './common/guards/api-key.guard.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);

  app.use(cookieParser());
  app.useGlobalGuards(new ApiKeyGuard(configService));
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const allowedOrigins = configService.get<string>('cors.allowedOrigins') ?? '';
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
