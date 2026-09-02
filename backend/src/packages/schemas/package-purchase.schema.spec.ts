import mongoose from 'mongoose';
import {
  PackagePurchaseSchema,
  PaymentMethod,
  PaymentStatus,
  PurchaseType,
} from './package-purchase.schema';
import { AdPackageType } from './ad-package.schema';
import { EntitlementKind } from '../entitlement.types';

/**
 * Validates the schema itself, with no service or mock in the way.
 *
 * Every other spec mocks the model, so a document the real schema rejects still
 * looks fine to them. That is how shorts packages shipped unbuyable: the client
 * sent `paymentMethod: 'manual'`, mongoose enforces the enum, and the save threw
 * for every purchase.
 */
describe('PackagePurchase schema', () => {
  const Model = mongoose.model('PackagePurchaseSpec', PackagePurchaseSchema);

  const base = {
    sellerId: new mongoose.Types.ObjectId(),
    packageId: new mongoose.Types.ObjectId(),
    quantity: 10,
    remainingQuantity: 10,
    duration: 30,
    price: 500,
    paymentStatus: PaymentStatus.PENDING,
  };

  const validate = (overrides: Record<string, unknown>) =>
    new Model({ ...base, ...overrides }).validate();

  it('accepts a manually-paid shorts purchase', async () => {
    // Shorts packages are paid outside the app and confirmed by an admin, so
    // this is the only method that flow ever uses.
    await expect(
      validate({
        purchaseType: PurchaseType.SHORTS,
        paymentMethod: PaymentMethod.MANUAL,
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    PaymentMethod.JAZZCASH,
    PaymentMethod.EASYPAISA,
    PaymentMethod.CARD,
  ])('accepts a gateway-paid ads purchase via %s', async (paymentMethod) => {
    await expect(
      validate({
        purchaseType: PurchaseType.ADS,
        type: AdPackageType.FEATURED_ADS,
        paymentMethod,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects a payment method that is not a known one', async () => {
    await expect(
      validate({
        purchaseType: PurchaseType.SHORTS,
        paymentMethod: 'paypal',
      }),
    ).rejects.toThrow(/not a valid enum value for path `paymentMethod`/);
  });

  it('accepts the -1 expiry marker on the flat counter', async () => {
    await expect(
      validate({
        purchaseType: PurchaseType.SHORTS,
        paymentMethod: PaymentMethod.MANUAL,
        remainingQuantity: -1,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects a flat balance below the expiry marker', async () => {
    await expect(
      validate({
        purchaseType: PurchaseType.SHORTS,
        paymentMethod: PaymentMethod.MANUAL,
        remainingQuantity: -2,
      }),
    ).rejects.toThrow(/remainingQuantity/);
  });

  it('accepts a bundle carrying per-kind balances', async () => {
    await expect(
      validate({
        purchaseType: PurchaseType.ADS,
        type: AdPackageType.BUNDLE,
        paymentMethod: PaymentMethod.JAZZCASH,
        quantity: 25,
        remainingQuantity: 25,
        entitlements: [
          { kind: EntitlementKind.AD_SLOTS, quantity: 10, remaining: 10 },
          { kind: EntitlementKind.FEATURED_ADS, quantity: 10, remaining: 8 },
          { kind: EntitlementKind.SHORTS, quantity: 5, remaining: 0 },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects an entitlement of an unknown kind', async () => {
    await expect(
      validate({
        purchaseType: PurchaseType.ADS,
        type: AdPackageType.BUNDLE,
        paymentMethod: PaymentMethod.JAZZCASH,
        entitlements: [{ kind: 'stickers', quantity: 1, remaining: 1 }],
      }),
    ).rejects.toThrow(/kind/);
  });

  it('requires the purchase-type discriminator', async () => {
    // Every query separates the two shapes by this field, so a row without it
    // would be invisible to both.
    await expect(
      validate({ paymentMethod: PaymentMethod.MANUAL }),
    ).rejects.toThrow(/purchaseType/);
  });
});
