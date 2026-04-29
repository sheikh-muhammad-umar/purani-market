import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  PORT = 3000;

  @IsString()
  @IsOptional()
  MONGODB_URI = 'mongodb://localhost:27017/marketplace';

  @IsString()
  @IsOptional()
  REDIS_HOST = 'localhost';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  REDIS_PORT = 6379;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_NODE = 'http://localhost:9200';

  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET must be at least 32 characters for security',
  })
  @IsOptional()
  JWT_SECRET = 'your-jwt-secret-change-in-production';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  LISTING_ACTIVE_DAYS = 30;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  LISTING_DEACTIVATED_CLEANUP_DAYS = 7;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  DEFAULT_AD_LIMIT = 10;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  STALE_PENDING_REVIEW_MODERATION_DAYS = 14;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  STALE_ID_VERIFICATION_DAYS = 30;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
