import {
  Component,
  Input,
  signal,
  computed,
  HostListener,
  ElementRef,
  forwardRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string | number;
  label: string;
}

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cs-wrap" [class.cs-open]="isOpen()" [class.cs-disabled]="disabled">
      <button type="button" class="cs-trigger" (click)="toggle()" [disabled]="disabled">
        @if (selectedLabel()) {
          <span class="cs-text">{{ selectedLabel() }}</span>
        } @else {
          <span class="cs-placeholder">{{ placeholder }}</span>
        }
        <span class="material-symbols-rounded cs-arrow">expand_more</span>
      </button>
      @if (isOpen()) {
        <div class="cs-dropdown">
          @if (searchable && options.length > 3) {
            <div class="cs-search-wrap">
              <input
                #searchInput
                type="text"
                class="cs-search"
                placeholder="Search..."
                [value]="searchQuery()"
                (input)="searchQuery.set($any($event.target).value)"
                (click)="$event.stopPropagation()"
              />
            </div>
          }
          @for (opt of searchable && searchQuery() ? filteredOptions() : options; track opt.value) {
            <button
              type="button"
              class="cs-option"
              [class.cs-active]="opt.value === value"
              (click)="select(opt)"
            >
              {{ opt.label }}
            </button>
          }
          @if (searchable && searchQuery() && filteredOptions().length === 0) {
            <div class="cs-no-results">No results</div>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./custom-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true,
    },
  ],
})
export class CustomSelectComponent implements ControlValueAccessor {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Select...';
  @Input() disabled = false;
  @Input() searchable = false;

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  isOpen = signal(false);
  value: string | number = '';
  searchQuery = signal('');

  private onChange: (val: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly elRef: ElementRef) {}

  selectedLabel = signal('');

  filteredOptions = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.options;
    return this.options.filter((o) => o.label.toLowerCase().includes(q));
  });

  toggle(): void {
    if (this.disabled) return;
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.searchQuery.set('');
      setTimeout(() => this.searchInput?.nativeElement?.focus(), 0);
    }
  }

  select(opt: SelectOption): void {
    this.value = opt.value;
    this.selectedLabel.set(opt.label);
    this.onChange(opt.value);
    this.onTouched();
    this.isOpen.set(false);
    this.searchQuery.set('');
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  writeValue(val: any): void {
    this.value = val ?? '';
    const match = this.options.find((o) => o.value === val);
    this.selectedLabel.set(match?.label ?? '');
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
