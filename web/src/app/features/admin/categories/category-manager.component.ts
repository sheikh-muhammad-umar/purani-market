import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CategoriesService,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '../../../core/services/categories.service';
import { Category, CategoryAttribute, CategoryAttributeType } from '../../../core/models';
import { ATTRIBUTE_TYPE_OPTIONS } from '../../../core/constants/select-options';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';

interface TreeNode {
  category: Category;
  expanded: boolean;
  children: TreeNode[];
}

@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './category-manager.component.html',
  styleUrls: ['./category-manager.component.scss'],
})
export class CategoryManagerComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly tree = signal<TreeNode[]>([]);
  readonly flatCategories = signal<Category[]>([]);
  readonly selectedCategory = signal<Category | null>(null);

  // Panel state
  activePanel: 'none' | 'add' | 'edit' | 'attributes' | 'features' = 'none';

  // Add/Edit form
  formName = '';
  formSlug = '';
  formParentId = '';
  formIsActive = true;

  // Attribute editing
  editingAttributes: CategoryAttribute[] = [];
  readonly attributeTypes: CategoryAttributeType[] = [
    'text',
    'number',
    'select',
    'multiselect',
    'boolean',
    'range',
    'year',
  ];
  readonly attributeTypeOptions: SelectOption[] = ATTRIBUTE_TYPE_OPTIONS;

  // Features editing
  editingFeatures: string[] = [];
  newFeature = '';

  readonly possibleParents = computed(() => {
    const cats = this.flatCategories();
    const sel = this.selectedCategory();
    if (this.activePanel === 'add') {
      return cats.filter((c) => c.level < 3);
    }
    if (this.activePanel === 'edit' && sel) {
      const descendants = this.getDescendantIds(sel._id, cats);
      return cats.filter((c) => c._id !== sel._id && !descendants.has(c._id) && c.level < 3);
    }
    return [];
  });

  readonly parentOptions = computed<SelectOption[]>(() => {
    return [
      { value: '', label: 'None (Root)' },
      ...this.possibleParents().map((p) => ({
        value: p._id,
        label: `${p.name} (Level ${p.level})`,
      })),
    ];
  });

  constructor(readonly categoriesService: CategoriesService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);
    this.error.set(null);
    this.categoriesService.getAll().subscribe({
      next: (categories) => {
        this.flatCategories.set(categories);
        this.tree.set(this.buildTree(categories));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load categories. Please try again.');
        this.loading.set(false);
      },
    });
  }

  buildTree(categories: Category[]): TreeNode[] {
    const roots = categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    return roots.map((r) => this.buildNode(r, categories));
  }

  buildNode(cat: Category, all: Category[]): TreeNode {
    const children = all
      .filter((c) => c.parentId === cat._id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      category: cat,
      expanded: false,
      children: children.map((c) => this.buildNode(c, all)),
    };
  }

  toggleExpand(node: TreeNode): void {
    node.expanded = !node.expanded;
  }

  selectCategory(cat: Category): void {
    this.selectedCategory.set(cat);
    this.activePanel = 'none';
  }

  // --- ADD ---
  openAddForm(parentId?: string): void {
    this.formName = '';
    this.formSlug = '';
    this.formParentId = parentId || '';
    this.formIsActive = true;
    this.activePanel = 'add';
  }

  generateSlug(): void {
    this.formSlug = this.formName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  submitAdd(): void {
    if (!this.formName.trim() || !this.formSlug.trim()) return;
    const parent = this.flatCategories().find((c) => c._id === this.formParentId);
    const level = parent ? ((parent.level + 1) as 1 | 2 | 3) : 1;
    if (level > 3) return;

    const siblings = this.flatCategories().filter((c) =>
      this.formParentId ? c.parentId === this.formParentId : !c.parentId,
    );
    const sortOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sortOrder)) + 1 : 0;

    const payload: CreateCategoryPayload = {
      name: this.formName.trim(),
      slug: this.formSlug.trim(),
      level,
      isActive: this.formIsActive,
      sortOrder,
    };
    if (this.formParentId) payload.parentId = this.formParentId;

    this.saving.set(true);
    this.categoriesService.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.activePanel = 'none';
        this.loadCategories();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to create category.');
      },
    });
  }

  // --- EDIT ---
  openEditForm(cat: Category): void {
    this.selectedCategory.set(cat);
    this.formName = cat.name;
    this.formSlug = cat.slug;
    this.formIsActive = cat.isActive;
    this.activePanel = 'edit';
  }

  submitEdit(): void {
    const sel = this.selectedCategory();
    if (!sel || !this.formName.trim() || !this.formSlug.trim()) return;

    const payload: UpdateCategoryPayload = {
      name: this.formName.trim(),
      slug: this.formSlug.trim(),
      isActive: this.formIsActive,
    };

    this.saving.set(true);
    this.categoriesService.update(sel._id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.activePanel = 'none';
        this.loadCategories();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to update category.');
      },
    });
  }

  // --- DELETE ---
  deleteCategory(cat: Category): void {
    this.saving.set(true);
    this.categoriesService.remove(cat._id).subscribe({
      next: () => {
        this.saving.set(false);
        if (this.selectedCategory()?._id === cat._id) {
          this.selectedCategory.set(null);
          this.activePanel = 'none';
        }
        this.loadCategories();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to delete category.');
      },
    });
  }

  // --- REORDER ---
  moveUp(node: TreeNode, siblings: TreeNode[]): void {
    const idx = siblings.indexOf(node);
    if (idx <= 0) return;
    this.swapSortOrder(siblings[idx - 1].category, node.category);
  }

  moveDown(node: TreeNode, siblings: TreeNode[]): void {
    const idx = siblings.indexOf(node);
    if (idx < 0 || idx >= siblings.length - 1) return;
    this.swapSortOrder(node.category, siblings[idx + 1].category);
  }

  private swapSortOrder(catA: Category, catB: Category): void {
    const orderA = catA.sortOrder;
    const orderB = catB.sortOrder;
    this.saving.set(true);
    this.categoriesService.update(catA._id, { sortOrder: orderB }).subscribe({
      next: () => {
        this.categoriesService.update(catB._id, { sortOrder: orderA }).subscribe({
          next: () => {
            this.saving.set(false);
            this.loadCategories();
          },
          error: () => {
            this.saving.set(false);
            this.error.set('Failed to reorder.');
          },
        });
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to reorder.');
      },
    });
  }

  // --- ATTRIBUTES ---
  openAttributes(cat: Category): void {
    this.selectedCategory.set(cat);
    this.editingAttributes = cat.attributes
      ? cat.attributes.map((a) => ({ ...a, options: a.options ? [...a.options] : [] }))
      : [];
    this.activePanel = 'attributes';
  }

  addAttribute(): void {
    this.editingAttributes.push({
      name: '',
      key: '',
      type: 'text',
      required: false,
      options: [],
    });
  }

  removeAttribute(index: number): void {
    this.editingAttributes.splice(index, 1);
  }

  generateAttributeKey(attr: CategoryAttribute): void {
    attr.key = attr.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  addAttributeOption(attr: CategoryAttribute): void {
    if (!attr.options) attr.options = [];
    attr.options.push('');
  }

  removeAttributeOption(attr: CategoryAttribute, idx: number): void {
    attr.options?.splice(idx, 1);
  }

  trackByIndex(index: number): number {
    return index;
  }

  saveAttributes(): void {
    const sel = this.selectedCategory();
    if (!sel) return;
    const valid = this.editingAttributes.every((a) => a.name.trim() && a.key.trim());
    if (!valid) return;

    this.saving.set(true);
    this.categoriesService.updateAttributes(sel._id, this.editingAttributes).subscribe({
      next: () => {
        this.saving.set(false);
        this.activePanel = 'none';
        this.loadCategories();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to update attributes.');
      },
    });
  }

  // --- FEATURES ---
  openFeatures(cat: Category): void {
    this.selectedCategory.set(cat);
    this.editingFeatures = cat.features ? [...cat.features] : [];
    this.newFeature = '';
    this.activePanel = 'features';
  }

  addFeature(): void {
    const f = this.newFeature.trim();
    if (f && !this.editingFeatures.includes(f)) {
      this.editingFeatures.push(f);
      this.newFeature = '';
    }
  }

  removeFeature(index: number): void {
    this.editingFeatures.splice(index, 1);
  }

  saveFeatures(): void {
    const sel = this.selectedCategory();
    if (!sel) return;

    this.saving.set(true);
    this.categoriesService.updateFeatures(sel._id, this.editingFeatures).subscribe({
      next: () => {
        this.saving.set(false);
        this.activePanel = 'none';
        this.loadCategories();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to update features.');
      },
    });
  }

  // --- HELPERS ---
  private getDescendantIds(parentId: string, cats: Category[]): Set<string> {
    const ids = new Set<string>();
    const children = cats.filter((c) => c.parentId === parentId);
    for (const child of children) {
      ids.add(child._id);
      const sub = this.getDescendantIds(child._id, cats);
      sub.forEach((id) => ids.add(id));
    }
    return ids;
  }

  hasChildren(cat: Category): boolean {
    return this.flatCategories().some((c) => c.parentId === cat._id);
  }
}
