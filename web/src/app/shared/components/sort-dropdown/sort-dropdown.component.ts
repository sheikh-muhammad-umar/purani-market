import { Component, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SortOption {
  label: string;
  sort: string;
  order: 'asc' | 'desc';
}

@Component({
  selector: 'app-sort-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sort-dropdown.component.html',
  styleUrls: ['./sort-dropdown.component.scss'],
})
export class SortDropdownComponent {
  options = input<SortOption[]>([
    { label: 'Newly listed', sort: 'createdAt', order: 'desc' },
    { label: 'Most relevant', sort: 'viewCount', order: 'desc' },
    { label: 'Lowest price', sort: 'price.amount', order: 'asc' },
    { label: 'Highest price', sort: 'price.amount', order: 'desc' },
  ]);

  selected = input<SortOption | null>(null);
  sortChanged = output<SortOption>();

  open = signal(false);

  get currentLabel(): string {
    return this.selected()?.label || this.options()[0]?.label || 'Sort';
  }

  toggle(): void {
    this.open.update((v) => !v);
  }

  select(option: SortOption): void {
    this.sortChanged.emit(option);
    this.open.set(false);
  }

  isSelected(option: SortOption): boolean {
    const sel = this.selected();
    if (!sel) return option === this.options()[0];
    return sel.sort === option.sort && sel.order === option.order;
  }
}
