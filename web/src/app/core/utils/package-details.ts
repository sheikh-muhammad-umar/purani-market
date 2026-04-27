import { Listing } from '../models';

/** Extracted package details from a listing's purchaseId field. */
export interface PackageDetails {
  purchaseId: string;
  packageName: string;
  packageType: string;
}

const DEFAULT_PACKAGE_NAME = 'Package';
const DEFAULT_PACKAGE_TYPE = 'featured_ads';

/**
 * Extracts package details from a listing's `purchaseId` field,
 * which can be either a plain string ID or a populated object.
 */
export function extractPackageDetails(listing: Listing): PackageDetails {
  const raw = listing.purchaseId;
  if (!raw) {
    return { purchaseId: '', packageName: DEFAULT_PACKAGE_NAME, packageType: DEFAULT_PACKAGE_TYPE };
  }
  if (typeof raw === 'string') {
    return {
      purchaseId: raw,
      packageName: DEFAULT_PACKAGE_NAME,
      packageType: DEFAULT_PACKAGE_TYPE,
    };
  }
  return {
    purchaseId: raw._id,
    packageName: raw.packageId?.name ?? DEFAULT_PACKAGE_NAME,
    packageType: raw.packageId?.type ?? DEFAULT_PACKAGE_TYPE,
  };
}
