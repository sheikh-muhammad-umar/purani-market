import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  HostListener,
  ElementRef,
  forwardRef,
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
          @for (opt of options; track opt.value) {
            <button
              type="button"
              class="cs-option"
              [class.cs-active]="opt.value === value"
              (click)="select(opt)"
            >{{ opt.label }}</button>
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

  isOpen = signal(false);
  value: string | number = '';

  private onChange: (val: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly elRef: ElementRef) {}

  selectedLabel = signal('');

  toggle(): void {
    if (this.disabled) return;
    this.isOpen.update(v => !v);
  }

  select(opt: SelectOption): void {
    this.value = opt.value;
    this.selectedLabel.set(opt.label);
    this.onChange(opt.value);
    this.onTouched();
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  writeValue(val: any): void {
    this.value = val ?? '';
    const match = this.options.find(o => o.value === val);
    this.selectedLabel.set(match?.label ?? '');
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}
