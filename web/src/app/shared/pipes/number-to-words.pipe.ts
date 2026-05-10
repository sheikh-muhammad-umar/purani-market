import { Pipe, PipeTransform } from '@angular/core';

/**
 * Converts a number to a readable South Asian format.
 * e.g. 14438733 → "1 crore 44 lac 38 thousand 7 hundred and 33"
 */
@Pipe({ name: 'numberToWords', standalone: true })
export class NumberToWordsPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (num == null || isNaN(num) || num <= 100) return '';
    if (num < 0) return 'minus ' + this.transform(-num);
    return this.convert(num);
  }

  private convert(n: number): string {
    const parts: string[] = [];

    // Crore (1,00,00,000)
    if (n >= 10000000) {
      const crores = Math.floor(n / 10000000);
      parts.push(`${crores} crore`);
      n %= 10000000;
    }

    // Lac (1,00,000)
    if (n >= 100000) {
      const lacs = Math.floor(n / 100000);
      parts.push(`${lacs} lac`);
      n %= 100000;
    }

    // Thousand (1,000)
    if (n >= 1000) {
      const thousands = Math.floor(n / 1000);
      parts.push(`${thousands} thousand`);
      n %= 1000;
    }

    // Hundred (100)
    if (n >= 100) {
      const hundreds = Math.floor(n / 100);
      parts.push(`${hundreds} hundred`);
      n %= 100;
    }

    // Remainder (1-99)
    if (n > 0) {
      const prefix = parts.length > 0 ? 'and ' : '';
      parts.push(prefix + n);
    }

    return parts.join(' ');
  }
}
