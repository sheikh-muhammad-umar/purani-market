import { Pipe, PipeTransform } from '@angular/core';
import { CURRENCY_SYMBOL } from '../../core/constants/app';

@Pipe({ name: 'priceFormat', standalone: true })
export class PriceFormatPipe implements PipeTransform {
  transform(value: number | null | undefined, currency: string = CURRENCY_SYMBOL): string {
    if (value == null) return '';

    const formatted = new Intl.NumberFormat('en-PK', {
      maximumFractionDigits: 0,
    }).format(value);

    return `${currency} ${formatted}`;
  }
}
