import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a duration in seconds to a human-readable string (e.g., "1:05").
 * Returns '0:00' for falsy values.
 */
@Pipe({ name: 'formatDuration', standalone: true })
export class FormatDurationPipe implements PipeTransform {
  transform(seconds: number | undefined | null): string {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
