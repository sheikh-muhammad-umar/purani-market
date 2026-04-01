import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'priceFormat', standalone: true })
export class PriceFormatPipe implements PipeTransform {
  transform(value: number | null | undefined, currency: string = 'PKR'): string {
    if (value == null) return '';

    const formatted = new Intl.NumberFormat('en-PK', {
      maximumFractionDigits: 0,
    }).format(value);

    return `${currency} ${formatted}`;
  }
}
