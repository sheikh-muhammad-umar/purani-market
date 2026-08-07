import { Particle, SplashStep, SplashCategory } from './app-loader.types';

/** Brand name displayed in splash */
export const BRAND_NAME = 'marketplace';

/** Tagline shown below brand name */
export const BRAND_TAGLINE = 'Your trusted online marketplace';

/** Number of horizontal grid lines in splash background */
export const GRID_LINE_COUNT = 8;

/** Number of floating particles */
export const PARTICLE_COUNT = 18;

/** Splash progress interval (ms) */
export const PROGRESS_INTERVAL_MS = 30;

/** Step rotation interval (ms) */
export const STEP_INTERVAL_MS = 2000;

/** Category highlight rotation interval (ms) */
export const CATEGORY_INTERVAL_MS = 800;

/** Content entrance delay (ms) */
export const CONTENT_ENTRANCE_DELAY_MS = 100;

/** Dismiss fade-out duration (ms) */
export const DISMISS_DURATION_MS = 700;

/** Progress speed configuration for ~3 second total */
export const PROGRESS_SPEEDS = {
  slow: 0.7, // 0-30%
  medium: 1.0, // 30-70%
  fast: 1.5, // 70-100%
} as const;

/** Feature steps shown during splash */
export const SPLASH_STEPS: readonly SplashStep[] = [
  { icon: 'explore', text: 'Discover deals near you', color: 'primary' },
  { icon: 'storefront', text: 'Buy & sell with confidence', color: 'secondary' },
  { icon: 'forum', text: 'Chat & negotiate instantly', color: 'accent' },
  { icon: 'verified_user', text: 'Verified & secure platform', color: 'success' },
] as const;

/** Category cards shown during splash */
export const SPLASH_CATEGORIES: readonly SplashCategory[] = [
  { icon: 'directions_car', label: 'Cars' },
  { icon: 'phone_iphone', label: 'Phones' },
  { icon: 'two_wheeler', label: 'Bikes' },
  { icon: 'home', label: 'Property' },
  { icon: 'devices', label: 'Electronics' },
  { icon: 'checkroom', label: 'Fashion' },
] as const;

/** Pre-generated grid line indices */
export const GRID_LINES: readonly number[] = Array.from({ length: GRID_LINE_COUNT }, (_, i) => i);

/** Pre-generated particle configurations */
export const PARTICLES: readonly Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  id: i,
  x: (i * 5.8 + 3) % 100,
  delay: i * 0.35,
  duration: 5 + (i % 4) * 1.5,
  size: 4 + (i % 3) * 4,
  type: (['primary', 'secondary', 'accent'] as const)[i % 3],
}));

/** Pre-split brand letters for template iteration */
export const BRAND_LETTERS: readonly string[] = BRAND_NAME.split('');

/** Key used in sessionStorage to track if splash has been shown this session */
export const SPLASH_SHOWN_KEY = 'marketplace_splash_shown';
