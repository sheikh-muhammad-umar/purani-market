// class-transformer's decorators need this; other specs get it transitively
// through the Nest testing module, which this one does not use.
import 'reflect-metadata';
import { validate } from './env.validation';

/**
 * Guards the boot-time check that stands between a misconfigured deploy and a
 * platform signing tokens with a publicly-known secret.
 */
describe('environment validation', () => {
  /** A 40-character random-looking secret. */
  const goodSecret = 'a3f9c1e7b5d2486fa0c4e8b6d1f3a7c9e5b2d8f4';

  it('accepts a strong secret', () => {
    expect(() => validate({ JWT_SECRET: goodSecret })).not.toThrow();
  });

  it('refuses to start without a JWT secret', () => {
    // Previously optional with a committed default, so a deployment that forgot
    // to set it started anyway and signed every token with a value published in
    // this repository.
    expect(() => validate({})).toThrow(/JWT_SECRET/);
  });

  it('refuses a secret that is too short', () => {
    expect(() => validate({ JWT_SECRET: 'short' })).toThrow(
      /at least 32 characters/,
    );
  });

  it.each([
    'your-jwt-secret-change-in-production',
    'CHANGE_THIS_TO_A_STRONG_SECRET_PLEASE_OK',
    'placeholder-placeholder-placeholder-1234',
    'example-secret-example-secret-example-12',
  ])('refuses the placeholder %p even when long enough', (secret) => {
    // Length alone was never the test: the old default was 36 characters and
    // sailed past a 32-character floor while being common knowledge.
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(() => validate({ JWT_SECRET: secret })).toThrow(/placeholder/i);
  });

  it('still applies defaults to the optional settings', () => {
    const config = validate({ JWT_SECRET: goodSecret });
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.DEFAULT_LISTING_LIMIT).toBe(10);
  });

  it('rejects an unknown NODE_ENV rather than guessing', () => {
    // The production branches of the CSRF and unsigned-callback checks key off
    // this exact string, so a typo must not silently mean "not production".
    expect(() =>
      validate({ JWT_SECRET: goodSecret, NODE_ENV: 'prod' }),
    ).toThrow();
  });
});
