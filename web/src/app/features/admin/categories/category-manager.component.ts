import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  CategoriesService,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '../../../core/services/categories.service';
import {
  AttributeDefinitionsService,
  CreateAttributeDefinitionPayload,
} from '../../../core/services/attribute-definitions.service';
import {
  Category,
  CategoryAttribute,
  CategoryAttributeType,
  AttributeDefinition,
} from '../../../core/models';
import { ATTRIBUTE_TYPE_OPTIONS } from '../../../core/constants/select-options';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';

// --- Interfaces ---

interface TreeNode {
  category: Category;
  expanded: boolean;
  children: TreeNode[];
}

interface AssignedAttribute {
  definition: AttributeDefinition;
  required: boolean;
  options: string[];
  unit: string;
  rangeMin: number | null;
  rangeMax: number | null;
  allowOther: boolean;
}

interface PickerItem {
  def: AttributeDefinition;
  disabled: boolean;
  reason: string;
}

type PanelState = 'none' | 'add' | 'edit' | 'attributes' | 'features';

// --- Constants ---

const PICKER_REASON_ADDED = 'Already added';
const PICKER_REASON_INHERITED = 'Inherited from parent';
const MAX_CATEGORY_DEPTH = 3;
const SLUG_SEPARATOR = '-';
const KEY_SEPARATOR = '_';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './category-manager.component.html',
  styleUrls: ['./category-manager.component.scss'],
})
export class CategoryManagerComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly tree = signal<TreeNode[]>([]);
  readonly flatCategories = signal<Category[]>([]);
  readonly selectedCategory = signal<Category | null>(null);

  activePanel: PanelState = 'none';

  // Add/Edit form
  formName = '';
  formSlug = '';
  formIcon = '';
  formParentId = '';
  formIsActive = true;
  formHasBrands = false;

  // Attribute editing — registry-based
  readonly allDefinitions = signal<AttributeDefinition[]>([]);
  readonly filteredDefinitions = signal<PickerItem[]>([]);
  assignedAttributes: AssignedAttribute[] = [];
  parentAttributeKeys = new Set<string>();
  readonly inheritedAttributes = signal<CategoryAttribute[]>([]);
  readonly inheritedFeatures = signal<string[]>([]);
  readonly attributeWarning = signal<string | null>(null);
  attrSearchQuery = '';
  showAttrPicker = false;
  showNewAttrForm = false;
  newAttrName = '';
  newAttrKey = '';
  newAttrType: CategoryAttributeType = 'text';
  newAttrOptions: string[] = [];
  newAttrUnit = '';
  newAttrRangeMin: number | null = null;
  newAttrRangeMax: number | null = null;
  newAttrAllowOther = false;
  readonly attributeTypeOptions: SelectOption[] = ATTRIBUTE_TYPE_OPTIONS;

  // Features editing
  editingFeatures: string[] = [];
  newFeature = '';

  readonly possibleParents = computed(() => {
    const cats = this.flatCategories();
    const sel = this.selectedCategory();
    if (this.activePanel === 'add') {
      return cats.filter((c) => c.level < MAX_CATEGORY_DEPTH);
    }
    if (this.activePanel === 'edit' && sel) {
      const descendants = this.getDescendantIds(sel._id, cats);
      return cats.filter(
        (c) => c._id !== sel._id && !descendants.has(c._id) && c.level < MAX_CATEGORY_DEPTH,
      );
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

  constructor(
    readonly categoriesService: CategoriesService,
    private readonly attrDefService: AttributeDefinitionsService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadDefinitions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDefinitions(): void {
    this.attrDefService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (defs) => this.allDefinitions.set(defs),
      });
  }

  loadCategories(): void {
    this.loading.set(true);
    this.error.set(null);
    const currentId = this.selectedCategory()?._id;
    this.categoriesService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.flatCategories.set(categories);
          this.tree.set(this.buildTree(categories));
          this.loading.set(false);
          // Re-select the current category to refresh its data
          if (currentId) {
            const updated = categories.find((c) => c._id === currentId);
            if (updated) this.selectedCategory.set(updated);
          }
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
    this.loadInheritedInfo(cat);
  }

  private loadInheritedInfo(cat: Category): void {
    if (cat.parentId) {
      this.categoriesService
        .getInheritedAttributes(cat.parentId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: ({ attributes, features }) => {
            this.inheritedAttributes.set(attributes ?? []);
            this.inheritedFeatures.set(features ?? []);
          },
          error: () => {
            this.inheritedAttributes.set([]);
            this.inheritedFeatures.set([]);
          },
        });
    } else {
      this.inheritedAttributes.set([]);
      this.inheritedFeatures.set([]);
    }
  }

  // --- ADD ---
  openAddForm(parentId?: string): void {
    this.formName = '';
    this.formSlug = '';
    this.formIcon = '';
    this.formParentId = parentId || '';
    this.formIsActive = true;
    this.formHasBrands = false;
    this.activePanel = 'add';
  }

  generateSlug(): void {
    this.formSlug = this.formName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, SLUG_SEPARATOR)
      .replace(/^-|-$/g, '');
  }

  submitAdd(): void {
    if (!this.formName.trim() || !this.formSlug.trim()) return;
    const parent = this.flatCategories().find((c) => c._id === this.formParentId);
    const level = parent ? ((parent.level + 1) as 1 | 2 | 3) : 1;
    if (level > MAX_CATEGORY_DEPTH) return;

    const siblings = this.flatCategories().filter((c) =>
      this.formParentId ? c.parentId === this.formParentId : !c.parentId,
    );
    const sortOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sortOrder)) + 1 : 0;

    const payload: CreateCategoryPayload = {
      name: this.formName.trim(),
      slug: this.formSlug.trim(),
      icon: this.formIcon.trim(),
      level,
      isActive: this.formIsActive,
      hasBrands: this.formHasBrands,
      sortOrder,
    };
    if (this.formParentId) payload.parentId = this.formParentId;

    this.saving.set(true);
    this.categoriesService
      .create(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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
    this.formIcon = cat.icon || '';
    this.formIsActive = cat.isActive;
    this.formHasBrands = cat.hasBrands ?? false;
    this.activePanel = 'edit';
  }

  submitEdit(): void {
    const sel = this.selectedCategory();
    if (!sel || !this.formName.trim() || !this.formSlug.trim()) return;

    const payload: UpdateCategoryPayload = {
      name: this.formName.trim(),
      slug: this.formSlug.trim(),
      icon: this.formIcon.trim(),
      isActive: this.formIsActive,
      hasBrands: this.formHasBrands,
    };

    this.saving.set(true);
    this.categoriesService
      .update(sel._id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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
    this.categoriesService
      .remove(cat._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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
    this.categoriesService
      .update(catA._id, { sortOrder: orderB })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.categoriesService
            .update(catB._id, { sortOrder: orderA })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
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

  // --- ATTRIBUTES (Registry-based) ---
  openAttributes(cat: Category): void {
    this.selectedCategory.set(cat);
    this.attributeWarning.set(null);
    this.showAttrPicker = false;
    this.showNewAttrForm = false;
    this.attrSearchQuery = '';

    // Build assigned list from current category attributes by matching keys to definitions
    const defs = this.allDefinitions();
    this.assignedAttributes = (cat.attributes || []).map((attr) => {
      const def = defs.find((d) => d.key === attr.key);
      return {
        definition: def || {
          _id: '',
          name: attr.name,
          key: attr.key,
          type: attr.type,
          options: attr.options,
          unit: attr.unit,
          rangeMin: attr.rangeMin,
          rangeMax: attr.rangeMax,
          allowOther: attr.allowOther,
        },
        required: attr.required,
        options: attr.options ? [...attr.options] : [],
        unit: attr.unit || '',
        rangeMin: attr.rangeMin ?? null,
        rangeMax: attr.rangeMax ?? null,
        allowOther: attr.allowOther ?? false,
      };
    });

    this.parentAttributeKeys = new Set<string>();
    this.activePanel = 'attributes';

    if (cat.parentId) {
      this.categoriesService
        .getInheritedAttributes(cat.parentId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: ({ attributes }) => {
            this.parentAttributeKeys = new Set((attributes || []).map((a) => a.key));
          },
        });
    }
  }

  searchDefinitions(): void {
    const q = this.attrSearchQuery.toLowerCase().trim();
    const assignedKeys = new Set(this.assignedAttributes.map((a) => a.definition.key));
    let all = this.allDefinitions();
    if (q) {
      all = all.filter((d) => d.name.toLowerCase().includes(q) || d.key.toLowerCase().includes(q));
    }
    this.filteredDefinitions.set(
      all.map((d) => {
        if (assignedKeys.has(d.key)) {
          return { def: d, disabled: true, reason: PICKER_REASON_ADDED };
        }
        if (this.parentAttributeKeys.has(d.key)) {
          return { def: d, disabled: true, reason: PICKER_REASON_INHERITED };
        }
        return { def: d, disabled: false, reason: '' };
      }),
    );
  }

  toggleAttrPicker(): void {
    this.showAttrPicker = !this.showAttrPicker;
    this.showNewAttrForm = false;
    if (this.showAttrPicker) {
      this.attrSearchQuery = '';
      this.searchDefinitions();
    }
  }

  pickDefinition(def: AttributeDefinition): void {
    this.assignedAttributes.push({
      definition: def,
      required: false,
      options: def.options ? [...def.options] : [],
      unit: def.unit || '',
      rangeMin: def.rangeMin ?? null,
      rangeMax: def.rangeMax ?? null,
      allowOther: def.allowOther ?? false,
    });
    this.showAttrPicker = false;
    this.attrSearchQuery = '';
  }

  removeAssigned(index: number): void {
    this.assignedAttributes.splice(index, 1);
  }

  // --- Create new attribute definition inline ---
  openNewAttrForm(): void {
    this.showNewAttrForm = true;
    this.showAttrPicker = false;
    this.newAttrName = '';
    this.newAttrKey = '';
    this.newAttrType = 'text';
    this.newAttrOptions = [];
    this.newAttrUnit = '';
    this.newAttrRangeMin = null;
    this.newAttrRangeMax = null;
    this.newAttrAllowOther = false;
  }

  generateNewAttrKey(): void {
    this.newAttrKey = this.newAttrName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, KEY_SEPARATOR)
      .replace(/^_|_$/g, '');
  }

  addNewAttrOption(): void {
    this.newAttrOptions.push('');
  }

  removeNewAttrOption(idx: number): void {
    this.newAttrOptions.splice(idx, 1);
  }

  submitNewDefinition(): void {
    if (!this.newAttrName.trim() || !this.newAttrKey.trim()) return;

    const payload: CreateAttributeDefinitionPayload = {
      name: this.newAttrName.trim(),
      key: this.newAttrKey.trim(),
      type: this.newAttrType,
      options: this.newAttrOptions.filter((o) => o.trim()),
      unit: this.newAttrUnit || undefined,
      rangeMin: this.newAttrRangeMin ?? undefined,
      rangeMax: this.newAttrRangeMax ?? undefined,
      allowOther: this.newAttrAllowOther || undefined,
    };

    this.saving.set(true);
    this.attrDefService
      .create(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.showNewAttrForm = false;
          this.loadDefinitions();
          // Auto-assign the newly created definition
          this.assignedAttributes.push({
            definition: created,
            required: false,
            options: created.options ? [...created.options] : [],
            unit: created.unit || '',
            rangeMin: created.rangeMin ?? null,
            rangeMax: created.rangeMax ?? null,
            allowOther: created.allowOther ?? false,
          });
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err?.error?.message || 'Failed to create attribute definition.';
          this.attributeWarning.set(msg);
        },
      });
  }

  cancelNewAttrForm(): void {
    this.showNewAttrForm = false;
  }

  saveAttributes(): void {
    const sel = this.selectedCategory();
    if (!sel) return;

    this.attributeWarning.set(null);

    // Check for parent conflicts
    const duplicates = this.assignedAttributes
      .filter((a) => this.parentAttributeKeys.has(a.definition.key))
      .map((a) => a.definition.name);
    if (duplicates.length > 0) {
      this.attributeWarning.set(
        `These attributes already exist in a parent category: ${duplicates.join(', ')}`,
      );
      return;
    }

    // Use the new assign-attributes endpoint if all definitions have IDs
    const allHaveIds = this.assignedAttributes.every((a) => a.definition._id);
    if (allHaveIds) {
      const payload = this.assignedAttributes.map((a) => ({
        definitionId: a.definition._id,
        required: a.required,
        options: a.options?.length ? a.options : undefined,
        unit: a.unit || undefined,
        rangeMin: a.rangeMin ?? undefined,
        rangeMax: a.rangeMax ?? undefined,
        allowOther: a.allowOther || undefined,
      }));
      this.saving.set(true);
      this.categoriesService
        .assignAttributes(sel._id, payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.attributeWarning.set(null);
            this.activePanel = 'none';
            this.loadCategories();
          },
          error: (err) => {
            this.saving.set(false);
            const msg = err?.error?.message || 'Failed to update attributes.';
            this.attributeWarning.set(msg);
          },
        });
    } else {
      // Fallback: use legacy endpoint for any unregistered attributes
      const attrs: CategoryAttribute[] = this.assignedAttributes.map((a) => ({
        name: a.definition.name,
        key: a.definition.key,
        type: a.definition.type,
        options: a.options || [],
        required: a.required,
        unit: a.unit || a.definition.unit,
        rangeMin: a.rangeMin ?? a.definition.rangeMin,
        rangeMax: a.rangeMax ?? a.definition.rangeMax,
        allowOther: a.allowOther ?? a.definition.allowOther,
      }));
      this.saving.set(true);
      this.categoriesService
        .updateAttributes(sel._id, attrs)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.attributeWarning.set(null);
            this.activePanel = 'none';
            this.loadCategories();
          },
          error: () => {
            this.saving.set(false);
            this.attributeWarning.set('Failed to update attributes.');
          },
        });
    }
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
    this.categoriesService
      .updateFeatures(sel._id, this.editingFeatures)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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

  readonly hasChildrenMap = computed(() => {
    const cats = this.flatCategories();
    const parentIds = new Set(cats.filter((c) => c.parentId).map((c) => c.parentId!));
    return parentIds;
  });

  hasChildren(cat: Category): boolean {
    return this.hasChildrenMap().has(cat._id);
  }
}
