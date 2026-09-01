import { AdPackageType } from './schemas/ad-package.schema';
import {
  EntitlementKind,
  grants,
  normaliseEntitlements,
  packageEntitlements,
  purchaseBalances,
  remainingOf,
  totalQuantity,
  typeForEntitlements,
} from './entitlements';

describe('entitlements', () => {
  describe('packageEntitlements', () => {
    it('derives the equivalent grant for a package predating bundles', () => {
      // No back-fill was run, so every existing package is read through here.
      expect(
        packageEntitlements({ type: AdPackageType.AD_SLOTS, quantity: 5 }),
      ).toEqual([{ kind: EntitlementKind.AD_SLOTS, quantity: 5 }]);

      expect(
        packageEntitlements({ type: AdPackageType.FEATURED_ADS, quantity: 3 }),
      ).toEqual([{ kind: EntitlementKind.FEATURED_ADS, quantity: 3 }]);
    });

    it('prefers an explicit list over the legacy fields', () => {
      const explicit = [
        { kind: EntitlementKind.SHORTS, quantity: 4 },
        { kind: EntitlementKind.AD_SLOTS, quantity: 2 },
      ];
      expect(
        packageEntitlements({
          type: AdPackageType.BUNDLE,
          quantity: 6,
          entitlements: explicit,
        }),
      ).toEqual(explicit);
    });

    it('grants nothing for a bundle with no list, rather than guessing', () => {
      // A bundle's contents are only in the list. Falling back to type+quantity
      // would invent an entitlement the buyer never bought.
      expect(
        packageEntitlements({ type: AdPackageType.BUNDLE, quantity: 9 }),
      ).toEqual([]);
    });
  });

  describe('purchaseBalances', () => {
    it('reads a legacy ads purchase from its flat counter', () => {
      expect(
        purchaseBalances({
          purchaseType: 'ads',
          type: AdPackageType.FEATURED_ADS,
          quantity: 5,
          remainingQuantity: 2,
        }),
      ).toEqual([
        { kind: EntitlementKind.FEATURED_ADS, quantity: 5, remaining: 2 },
      ]);
    });

    it('identifies a shorts purchase by its discriminator, having no type', () => {
      expect(
        purchaseBalances({
          purchaseType: 'shorts',
          quantity: 10,
          remainingQuantity: 7,
        }),
      ).toEqual([{ kind: EntitlementKind.SHORTS, quantity: 10, remaining: 7 }]);
    });

    it('treats the -1 expiry marker as no balance, not a negative one', () => {
      // -1 means "expiry already processed" rather than a quantity.
      const [balance] = purchaseBalances({
        purchaseType: 'ads',
        type: AdPackageType.AD_SLOTS,
        quantity: 5,
        remainingQuantity: -1,
      });
      expect(balance.remaining).toBe(0);
    });

    it('reads a bundle purchase from its per-entitlement balances', () => {
      const balances = purchaseBalances({
        purchaseType: 'ads',
        type: AdPackageType.BUNDLE,
        quantity: 18,
        remainingQuantity: 18,
        entitlements: [
          { kind: EntitlementKind.AD_SLOTS, quantity: 10, remaining: 10 },
          { kind: EntitlementKind.FEATURED_ADS, quantity: 5, remaining: 1 },
          { kind: EntitlementKind.SHORTS, quantity: 3, remaining: 0 },
        ],
      });
      expect(balances).toHaveLength(3);
      expect(balances.map((b) => b.remaining)).toEqual([10, 1, 0]);
    });
  });

  describe('remainingOf / grants', () => {
    const bundle = {
      purchaseType: 'ads',
      type: AdPackageType.BUNDLE,
      quantity: 8,
      remainingQuantity: 8,
      entitlements: [
        { kind: EntitlementKind.FEATURED_ADS, quantity: 5, remaining: 2 },
        { kind: EntitlementKind.SHORTS, quantity: 3, remaining: 0 },
      ],
    };

    it('reports the balance of one kind', () => {
      expect(remainingOf(bundle, EntitlementKind.FEATURED_ADS)).toBe(2);
      expect(remainingOf(bundle, EntitlementKind.SHORTS)).toBe(0);
      // Never granted at all.
      expect(remainingOf(bundle, EntitlementKind.AD_SLOTS)).toBe(0);
    });

    it('distinguishes a spent entitlement from one never granted', () => {
      expect(grants(bundle, EntitlementKind.FEATURED_ADS)).toBe(true);
      expect(grants(bundle, EntitlementKind.SHORTS)).toBe(false);
      expect(grants(bundle, EntitlementKind.AD_SLOTS)).toBe(false);
    });
  });

  describe('normaliseEntitlements', () => {
    it('sums repeated kinds into one balance', () => {
      // Two rows of one kind would otherwise be spent down separately.
      expect(
        normaliseEntitlements([
          { kind: EntitlementKind.SHORTS, quantity: 3 },
          { kind: EntitlementKind.SHORTS, quantity: 2 },
        ]),
      ).toEqual([{ kind: EntitlementKind.SHORTS, quantity: 5 }]);
    });

    it('drops rows that grant nothing', () => {
      expect(
        normaliseEntitlements([
          { kind: EntitlementKind.AD_SLOTS, quantity: 0 },
          { kind: EntitlementKind.SHORTS, quantity: -4 },
          { kind: EntitlementKind.FEATURED_ADS, quantity: 1 },
        ]),
      ).toEqual([{ kind: EntitlementKind.FEATURED_ADS, quantity: 1 }]);
    });
  });

  describe('typeForEntitlements', () => {
    it('keeps the historical type for a single entitlement', () => {
      // So existing filters, labels and reporting keep working.
      expect(
        typeForEntitlements([{ kind: EntitlementKind.AD_SLOTS, quantity: 5 }]),
      ).toBe(AdPackageType.AD_SLOTS);
      expect(
        typeForEntitlements([
          { kind: EntitlementKind.FEATURED_ADS, quantity: 5 },
        ]),
      ).toBe(AdPackageType.FEATURED_ADS);
    });

    it('calls anything broader a bundle', () => {
      expect(
        typeForEntitlements([
          { kind: EntitlementKind.AD_SLOTS, quantity: 5 },
          { kind: EntitlementKind.SHORTS, quantity: 2 },
        ]),
      ).toBe(AdPackageType.BUNDLE);
    });

    it('calls a shorts-only package a bundle, having no legacy type of its own', () => {
      expect(
        typeForEntitlements([{ kind: EntitlementKind.SHORTS, quantity: 5 }]),
      ).toBe(AdPackageType.BUNDLE);
    });
  });

  it('totals quantities for the headline figure', () => {
    expect(
      totalQuantity([
        { kind: EntitlementKind.AD_SLOTS, quantity: 10 },
        { kind: EntitlementKind.FEATURED_ADS, quantity: 5 },
        { kind: EntitlementKind.SHORTS, quantity: 3 },
      ]),
    ).toBe(18);
  });
});
