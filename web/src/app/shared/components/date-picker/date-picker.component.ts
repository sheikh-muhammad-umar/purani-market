import {
  Component,
  Input,
  signal,
  computed,
  forwardRef,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.scss',
})
export class DatePickerComponent implements ControlValueAccessor {
  /** Minimum selectable date (YYYY-MM-DD) */
  @Input() min = '';
  /** Maximum selectable date (YYYY-MM-DD) — capped at today unless allowFuture is true */
  @Input() max = '';
  /** Set to true to allow selecting future dates (default: false) */
  @Input() allowFuture = false;

  open = signal(false);
  value = signal('');
  viewDate = signal(new Date());

  readonly monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  readonly dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  currentMonth = computed(() => this.monthNames[this.viewDate().getMonth()]);
  currentYear = computed(() => this.viewDate().getFullYear());

  days = computed(() => {
    const d = this.viewDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const selectedStr = this.value();
    const minStr = this.min;
    const todayStr = this.formatDate(today.getFullYear(), today.getMonth(), today.getDate());

    // Effective max: if allowFuture is false, always cap at today
    let effectiveMax = this.max;
    if (!this.allowFuture) {
      if (!effectiveMax || effectiveMax > todayStr) {
        effectiveMax = todayStr;
      }
    }

    const cells: {
      day: number;
      date: string;
      isToday: boolean;
      isSelected: boolean;
      isCurrentMonth: boolean;
      isDisabled: boolean;
    }[] = [];

    const isDisabled = (date: string): boolean => {
      if (minStr && date < minStr) return true;
      if (effectiveMax && date > effectiveMax) return true;
      return false;
    };

    // Previous month padding
    const prevDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevDays - i;
      const date = this.formatDate(year, month - 1, day);
      cells.push({
        day,
        date,
        isToday: false,
        isSelected: date === selectedStr,
        isCurrentMonth: false,
        isDisabled: isDisabled(date),
      });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = this.formatDate(year, month, day);
      const isToday =
        day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      cells.push({
        day,
        date,
        isToday,
        isSelected: date === selectedStr,
        isCurrentMonth: true,
        isDisabled: isDisabled(date),
      });
    }

    // Next month padding
    const remaining = 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const date = this.formatDate(year, month + 1, day);
      cells.push({
        day,
        date,
        isToday: false,
        isSelected: date === selectedStr,
        isCurrentMonth: false,
        isDisabled: isDisabled(date),
      });
    }

    return cells;
  });

  displayValue = computed(() => {
    const v = this.value();
    if (!v) return '';
    const d = new Date(v + 'T00:00:00');
    return `${d.getDate()} ${this.monthNames[d.getMonth()]} ${d.getFullYear()}`;
  });

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly elRef: ElementRef) {}

  writeValue(val: string): void {
    this.value.set(val || '');
    if (val) {
      this.viewDate.set(new Date(val + 'T00:00:00'));
    }
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  toggle(): void {
    this.open.update((o) => !o);
    if (this.open() && !this.value()) {
      this.viewDate.set(new Date());
    }
  }

  prevMonth(): void {
    this.viewDate.update((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    this.viewDate.update((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  selectDate(cell: { date: string; isDisabled: boolean }): void {
    if (cell.isDisabled) return;
    this.value.set(cell.date);
    this.onChange(cell.date);
    this.onTouched();
    this.open.set(false);
  }

  clear(): void {
    this.value.set('');
    this.onChange('');
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }

  private formatDate(year: number, month: number, day: number): string {
    const d = new Date(year, month, day);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}
