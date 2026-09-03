import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  registerDecorator,
  validateSync,
} from 'class-validator';

/**
 * Values that look like a template rather than a secret.
 *
 * Length alone is not enough: the previous default was long enough to pass a
 * 32-character floor while being public knowledge. Matched loosely, since the
 * point is to catch a value nobody meant to ship.
 */
const PLACEHOLDER_PATTERN =
  /change[-_ ]?this|change[-_ ]?in[-_ ]?production|your[-_ ]?secret|your[-_ ]?jwt|placeholder|example|xxxx/i;

/** Rejects a secret that is obviously a template value. */
function NotPlaceholder(): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'notPlaceholder',
      target: target.constructor,
      propertyName: propertyName as string,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && !PLACEHOLDER_PATTERN.test(value),
        defaultMessage: () =>
          `${String(propertyName)} looks like a placeholder — set a real, randomly generated value`,
      },
    });
  };
}

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

  /**
   * Required, with no default and no placeholder accepted.
   *
   * It used to be `@IsOptional()` with a 36-character default — which satisfied
   * its own `MinLength(32)`, so validation could never reject a missing secret.
   * A deployment that forgot to set it signed every token with a string
   * committed to this repository, and anyone reading the code could mint a
   * super-admin token. Fail at boot instead: an app that will not start is a
   * problem you find, and one that starts with a known secret is a problem you
   * do not.
   */
  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET must be at least 32 characters for security',
  })
  @NotPlaceholder()
  JWT_SECRET!: string;

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
  DEFAULT_LISTING_LIMIT = 10;

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
    // The messages, not `errors.toString()`, which prints constraint names like
    // "minLength" and leaves whoever is staring at a failed boot to guess what
    // the actual requirement was.
    const details = errors
      .map((error) => {
        const messages = Object.values(error.constraints ?? {});
        return `${error.property}: ${messages.join('; ')}`;
      })
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return validatedConfig;
}
