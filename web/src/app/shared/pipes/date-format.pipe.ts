import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'dateFormat', standalone: true })
export class DateFormatPipe implements PipeTransform {
  transform(
    value: Date | string | null | undefined,
    format: 'relative' | 'short' | 'full' = 'relative',
  ): string {
    if (!value) return '';
    const date = new Date(value);

    if (format === 'relative') {
      return this.getRelativeTime(date);
    }
    if (format === 'short') {
      return date.toLocaleDateString();
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // A future timestamp would otherwise fall through every branch below and
    // report "Just now", because the diffs go negative.
    if (diffMs < 0) return this.monthDay(date);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    // Past a month, "5w ago" stops being useful. An absolute date is clearer,
    // but toLocaleDateString() renders "4/26/2026" — noisy in a card footer.
    if (diffDays < 365) return this.monthDay(date);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }

  /** e.g. "26 Apr" — no year, since it is within the last twelve months. */
  private monthDay(date: Date): string {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
}
