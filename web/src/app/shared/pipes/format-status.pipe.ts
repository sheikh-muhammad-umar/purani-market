import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a status string by replacing underscores with spaces.
 * E.g., 'pending_review' → 'pending review'
 */
@Pipe({ name: 'formatStatus', standalone: true })
export class FormatStatusPipe implements PipeTransform {
  transform(status: string | undefined | null): string {
    if (!status) return '';
    return status.replace(/_/g, ' ');
  }
}
