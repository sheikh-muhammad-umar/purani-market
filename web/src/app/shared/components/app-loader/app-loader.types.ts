/** Loader display modes */
export type LoaderMode = 'splash' | 'inline' | 'overlay';

/** Size variants for inline mode */
export type LoaderSize = 'sm' | 'md' | 'lg';

/** Particle color type */
export type ParticleType = 'primary' | 'secondary' | 'accent';

/** Particle configuration for splash animation */
export interface Particle {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  type: ParticleType;
}

/** Feature step displayed during splash */
export interface SplashStep {
  icon: string;
  text: string;
  color: string;
}

/** Category card displayed during splash */
export interface SplashCategory {
  icon: string;
  label: string;
}
