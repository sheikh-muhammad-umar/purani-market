import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { CategoryAttribute, CategoryAttributeType } from '../models/category.model';

/**
 * Shared behaviour for dynamic category attributes.
 *
 * The create-listing and edit-listing screens each render their own markup for
 * these fields, and that markup had drifted: `multiselect`, `range` and
 * `province_city` fell through to a plain text input on both screens, edit-listing
 * turned `year` into free text, and `rangeMin`/`rangeMax`/`allowOther` were
 * ignored everywhere. Keeping the *semantics* here means the two screens can
 * differ in presentation without disagreeing about what a value means, what
 * counts as filled in, or what shape gets sent to the API.
 */

/** Sentinel option value used to reveal the free-text box when `allowOther` is set. */
export const OTHER_OPTION_VALUE = '__other__';

/** Lower bound for `year` pickers when the attribute does not specify one. */
export const DEFAULT_YEAR_FLOOR = 1970;

/** The value shape held by a `range` control. */
export interface RangeValue {
  min: number | string | null;
  max: number | string | null;
}

/**
 * The value shape held by a `province_city` control.
 *
 * Ids keep the reference stable if a location is renamed; the names are
 * denormalised because search indexes, filters and facets all work off them.
 */
export interface ProvinceCityValue {
  provinceId: string;
  cityId: string;
  province: string;
  city: string;
}

/**
 * Whether a value should be treated as "not supplied".
 *
 * The previous check was a bare truthiness test (`!ctrl.value`), which rejected
 * two legitimate answers: the number `0` (0 previous owners, 0 km) and the
 * boolean `false` (an unchecked required checkbox). Those now count as supplied.
 */
export function isAttributeValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  // "Other" chosen but nothing typed yet is not an answer.
  if (value === OTHER_OPTION_VALUE) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    // A range counts as supplied once either bound is set; a province_city
    // needs at least the province.
    if ('min' in record || 'max' in record) {
      return isAttributeValueEmpty(record['min']) && isAttributeValueEmpty(record['max']);
    }
    if ('provinceId' in record || 'cityId' in record) {
      return isAttributeValueEmpty(record['provinceId']);
    }
    return Object.keys(record).length === 0;
  }
  // Numbers (including 0) and booleans (including false) are real answers.
  return false;
}

/** Whether a required attribute has been answered. Optional attributes always pass. */
export function isAttributeSatisfied(attr: CategoryAttribute, value: unknown): boolean {
  if (!attr.required) return true;
  return !isAttributeValueEmpty(value);
}

/** The value a freshly created control for this attribute should start with. */
export function initialAttributeValue(attr: CategoryAttribute): unknown {
  switch (attr.type) {
    case 'multiselect':
      return [];
    case 'boolean':
      return false;
    case 'range':
      return { min: null, max: null } satisfies RangeValue;
    case 'province_city':
      return {
        provinceId: '',
        cityId: '',
        province: '',
        city: '',
      } satisfies ProvinceCityValue;
    default:
      return '';
  }
}

/**
 * Enforces `rangeMin`/`rangeMax` on a `range` control and rejects an inverted
 * span. Angular's `Validators.min`/`max` only understand scalar values, so the
 * object-valued range needs its own check.
 */
export function attributeRangeValidator(attr: CategoryAttribute): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as RangeValue | null;
    if (!value || isAttributeValueEmpty(value)) return null;

    const min = toNumberOrNull(value.min);
    const max = toNumberOrNull(value.max);

    if (value.min !== null && value.min !== '' && min === null) return { rangeInvalid: true };
    if (value.max !== null && value.max !== '' && max === null) return { rangeInvalid: true };
    if (min !== null && max !== null && min > max) return { rangeOrder: true };
    if (attr.rangeMin !== undefined) {
      if ((min !== null && min < attr.rangeMin) || (max !== null && max < attr.rangeMin)) {
        return { rangeMin: { required: attr.rangeMin } };
      }
    }
    if (attr.rangeMax !== undefined) {
      if ((min !== null && min > attr.rangeMax) || (max !== null && max > attr.rangeMax)) {
        return { rangeMax: { required: attr.rangeMax } };
      }
    }
    return null;
  };
}

/** Requires at least the province half of a `province_city` value. */
export function provinceCityValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as ProvinceCityValue | null;
    if (!value || isAttributeValueEmpty(value)) return null;
    return isAttributeValueEmpty(value.provinceId) ? { provinceRequired: true } : null;
  };
}

/**
 * Validators for an attribute control, derived from its definition.
 *
 * `required` is intentionally *not* expressed as `Validators.required`: that
 * validator rejects `false` and empty arrays, which are valid answers for
 * boolean and multiselect. Required-ness is checked through
 * `isAttributeSatisfied` instead, so the rules stay consistent across types.
 */
export function buildAttributeValidators(attr: CategoryAttribute): ValidatorFn[] {
  const validators: ValidatorFn[] = [];

  switch (attr.type) {
    case 'number':
    case 'year': {
      const min = attr.type === 'year' ? (attr.rangeMin ?? DEFAULT_YEAR_FLOOR) : attr.rangeMin;
      const max = attr.type === 'year' ? (attr.rangeMax ?? currentYear()) : attr.rangeMax;
      if (min !== undefined) validators.push(Validators.min(min));
      if (max !== undefined) validators.push(Validators.max(max));
      break;
    }
    case 'range':
      validators.push(attributeRangeValidator(attr));
      break;
    case 'province_city':
      validators.push(provinceCityValidator());
      break;
    case 'text':
      validators.push(Validators.maxLength(200));
      break;
    default:
      break;
  }

  return validators;
}

/** Descending year list for `year` pickers, clamped to the attribute's bounds. */
export function attributeYearOptions(
  attr: Pick<CategoryAttribute, 'rangeMin' | 'rangeMax'>,
): number[] {
  const max = attr.rangeMax ?? currentYear();
  const min = attr.rangeMin ?? DEFAULT_YEAR_FLOOR;
  if (max < min) return [];
  return Array.from({ length: max - min + 1 }, (_, i) => max - i);
}

/**
 * Options for a `select`, with a leading placeholder and a trailing "Other"
 * entry when the attribute allows a value outside the list.
 */
export function attributeSelectOptions(
  attr: Pick<CategoryAttribute, 'options' | 'allowOther'>,
  placeholder = 'Select',
): { value: string; label: string }[] {
  const options = [
    { value: '', label: placeholder },
    ...(attr.options ?? []).map((opt) => ({ value: opt, label: opt })),
  ];
  if (attr.allowOther) {
    options.push({ value: OTHER_OPTION_VALUE, label: 'Other' });
  }
  return options;
}

/** Whether the free-text "Other" box should be shown for the current value. */
export function isOtherSelected(attr: CategoryAttribute, value: unknown): boolean {
  if (!attr.allowOther) return false;
  if (value === OTHER_OPTION_VALUE) return true;
  // A previously saved custom value is not in `options`, so treat it as "Other".
  if (typeof value === 'string' && value.trim() !== '') {
    return !(attr.options ?? []).includes(value);
  }
  return false;
}

/**
 * Normalises a control value into the shape the API expects.
 *
 * Returns `undefined` for an unanswered optional attribute so the caller can
 * omit the key rather than persist an empty string.
 */
export function coerceAttributeValue(attr: CategoryAttribute, raw: unknown): unknown {
  if (isAttributeValueEmpty(raw)) return undefined;

  switch (attr.type) {
    case 'number':
    case 'year':
      return toNumberOrNull(raw) ?? undefined;
    case 'boolean':
      return raw === true || raw === 'true';
    case 'multiselect':
      return Array.isArray(raw) ? raw.filter((v) => !isAttributeValueEmpty(v)) : [raw];
    case 'range': {
      const value = raw as RangeValue;
      const min = toNumberOrNull(value.min);
      const max = toNumberOrNull(value.max);
      const range: Record<string, number> = {};
      if (min !== null) range['min'] = min;
      if (max !== null) range['max'] = max;
      return Object.keys(range).length > 0 ? range : undefined;
    }
    case 'province_city': {
      const value = raw as ProvinceCityValue;
      if (isAttributeValueEmpty(value.provinceId)) return undefined;
      const out: ProvinceCityValue = {
        provinceId: value.provinceId,
        cityId: value.cityId ?? '',
        province: value.province ?? '',
        city: value.city ?? '',
      };
      return out;
    }
    default:
      // The sentinel is a UI affordance, never a stored value; `isAttributeValueEmpty`
      // already screens it out, so anything reaching here is real text.
      return typeof raw === 'string' ? raw.trim() : raw;
  }
}

/** Human-readable message for a failed attribute validator, or `''` if valid. */
export function attributeErrorMessage(
  attr: CategoryAttribute,
  errors: ValidationErrors | null,
): string {
  if (!errors) return '';
  if (errors['rangeOrder']) return `${attr.name} minimum cannot exceed the maximum`;
  if (errors['rangeInvalid']) return `Enter a valid ${attr.name.toLowerCase()}`;
  if (errors['provinceRequired']) return `Select a province for ${attr.name.toLowerCase()}`;
  if (errors['rangeMin']) return `${attr.name} cannot be below ${errors['rangeMin'].required}`;
  if (errors['rangeMax']) return `${attr.name} cannot be above ${errors['rangeMax'].required}`;
  if (errors['min']) return `${attr.name} cannot be below ${errors['min'].min}`;
  if (errors['max']) return `${attr.name} cannot be above ${errors['max'].max}`;
  if (errors['maxlength']) return `${attr.name} is too long`;
  return `Enter a valid ${attr.name.toLowerCase()}`;
}

/** Attribute types whose control holds a scalar the templates can bind directly. */
export function isScalarAttributeType(type: CategoryAttributeType): boolean {
  return type !== 'multiselect' && type !== 'range' && type !== 'province_city';
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function currentYear(): number {
  return new Date().getFullYear();
}
