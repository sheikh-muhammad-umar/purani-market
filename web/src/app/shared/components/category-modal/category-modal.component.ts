import { Component, signal, computed, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Category } from '../../../core/models';

@Component({
  selector: 'app-category-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-modal.component.html',
  styleUrl: './category-modal.component.scss',
})
export class CategoryModalComponent {
  allCategories = input<Category[]>([]);
  rootCategory = input<Category | null>(null);

  closed = output<void>();

  readonly parentStack = signal<Category[]>([]);

  readonly currentParent = computed(() => {
    const stack = this.parentStack();
    return stack.length > 0 ? stack[stack.length - 1] : this.rootCategory();
  });

  readonly breadcrumb = computed<Category[]>(() => {
    const root = this.rootCategory();
    if (!root) return [];
    return [root, ...this.parentStack()];
  });

  readonly currentChildren = computed(() => {
    const parent = this.currentParent();
    if (!parent) return [];
    return this.allCategories()
      .filter((c) => c.parentId === parent._id && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  constructor(private readonly router: Router) {}

  hasChildren(categoryId: string): boolean {
    return this.allCategories().some((c) => c.parentId === categoryId && c.isActive);
  }

  drillInto(category: Category): void {
    this.parentStack.update((stack) => [...stack, category]);
  }

  navigateTo(category: Category): void {
    this.closed.emit();
    this.router.navigate(['/categories', category.slug]);
  }

  goToBreadcrumb(index: number): void {
    if (index === 0) {
      this.parentStack.set([]);
    } else {
      this.parentStack.update((stack) => stack.slice(0, index));
    }
  }

  close(): void {
    this.closed.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close();
    }
  }
}
