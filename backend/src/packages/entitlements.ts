import { AdPackageType } from './schemas/ad-package.schema.js';
import {
  EntitlementBalance,
  EntitlementGrant,
  EntitlementKind,
} from './entitlement.types.js';

// Re-exported so callers have one import site for the whole vocabulary.
export { EntitlementKind };
export type { EntitlementGrant, EntitlementBalance };

/**
 * A package's *type* is how it is presented and filtered; its entitlements are
 * what the buyer actually receives. Before bundles the two were the same thing,
 * which is why `type` doubled as both.
 */

/** Shape shared by packages and purchases that carry entitlements. */
interface HasEntitlements {
  type?: AdPackageType;
  quantity?: number;
  entitlements?: EntitlementGrant[];
}

interface HasBalances {
  /**
   * Shorts purchases carry no `type` — the collection's `purchaseType`
   * discriminator is what identifies them, so it has to be consulted here too.
   */
  purchaseType?: string;
  type?: AdPackageType;
  quantity?: number;
  remainingQuantity?: number;
  entitlements?: EntitlementBalance[];
}

/**
 * The legacy single-entitlement types, keyed by the `type` that used to imply them.
 *
 * `bundle` is absent deliberately: a bundle has no meaning without an explicit
 * entitlement list, so falling back for one would silently grant nothing.
 */
const LEGACY_KIND_BY_TYPE: Partial<Record<AdPackageType, EntitlementKind>> = {
  [AdPackageType.AD_SLOTS]: EntitlementKind.AD_SLOTS,
  [AdPackageType.FEATURED_ADS]: EntitlementKind.FEATURED_ADS,
};

/**
 * What a package grants, whichever era it was created in.
 *
 * Packages predating bundles carry only `type` + `quantity`; reading them through
 * here means no back-fill was needed and no consumer has to know the difference.
 */
export function packageEntitlements(pkg: HasEntitlements): EntitlementGrant[] {
  if (pkg.entitlements?.length) {
    return pkg.entitlements.map((e) => ({
      kind: e.kind,
      quantity: e.quantity,
    }));
  }
  const kind = pkg.type ? LEGACY_KIND_BY_TYPE[pkg.type] : undefined;
  if (!kind || !pkg.quantity) return [];
  return [{ kind, quantity: pkg.quantity }];
}

/** What a purchase still holds, for a purchase of either era. */
export function purchaseBalances(purchase: HasBalances): EntitlementBalance[] {
  if (purchase.entitlements?.length) {
    return purchase.entitlements.map((e) => ({
      kind: e.kind,
      quantity: e.quantity,
      remaining: e.remaining,
    }));
  }
  // A shorts purchase has no `type`; its kind comes from the discriminator.
  const kind =
    purchase.purchaseType === 'shorts'
      ? EntitlementKind.SHORTS
      : purchase.type
        ? LEGACY_KIND_BY_TYPE[purchase.type]
        : undefined;
  if (!kind || purchase.quantity === undefined) return [];
  return [
    {
      kind,
      quantity: purchase.quantity,
      // A legacy purchase uses -1 to mean "expiry already processed", which is
      // not a balance. Clamp so callers never see a negative remainder.
      remaining: Math.max(0, purchase.remainingQuantity ?? 0),
    },
  ];
}

/** How much of one kind a purchase still holds. */
export function remainingOf(
  purchase: HasBalances,
  kind: EntitlementKind,
): number {
  const match = purchaseBalances(purchase).find((e) => e.kind === kind);
  return match?.remaining ?? 0;
}

/** Whether a purchase can still be spent on `kind`. */
export function grants(purchase: HasBalances, kind: EntitlementKind): boolean {
  return remainingOf(purchase, kind) > 0;
}

/**
 * Collapses a submitted entitlement list into one row per kind.
 *
 * Two rows of the same kind would each get their own counter, so a bundle
 * offering "5 shorts" twice would be spent down separately and read as 5 in the
 * UI. Summing keeps one balance per kind.
 */
export function normaliseEntitlements(
  entitlements: EntitlementGrant[],
): EntitlementGrant[] {
  const totals = new Map<EntitlementKind, number>();
  for (const { kind, quantity } of entitlements) {
    if (quantity <= 0) continue;
    totals.set(kind, (totals.get(kind) ?? 0) + quantity);
  }
  return [...totals.entries()].map(([kind, quantity]) => ({ kind, quantity }));
}

/**
 * The `type` a package with these entitlements should present as.
 *
 * A single entitlement keeps its historical type so existing filters, labels and
 * reporting continue to work; anything broader is a bundle.
 */
export function typeForEntitlements(
  entitlements: EntitlementGrant[],
): AdPackageType {
  if (entitlements.length === 1) {
    const [only] = entitlements;
    if (only.kind === EntitlementKind.AD_SLOTS) return AdPackageType.AD_SLOTS;
    if (only.kind === EntitlementKind.FEATURED_ADS) {
      return AdPackageType.FEATURED_ADS;
    }
  }
  return AdPackageType.BUNDLE;
}

/** Total units across every entitlement, for display and legacy `quantity`. */
export function totalQuantity(entitlements: EntitlementGrant[]): number {
  return entitlements.reduce((sum, e) => sum + e.quantity, 0);
}

/** Human wording for each kind, for notifications and other seller-facing copy. */
export const ENTITLEMENT_LABELS: Record<EntitlementKind, string> = {
  [EntitlementKind.AD_SLOTS]: 'ad slot(s)',
  [EntitlementKind.FEATURED_ADS]: 'featured ad(s)',
  [EntitlementKind.SHORTS]: 'short(s)',
};
