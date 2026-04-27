# Requirements Document

## Introduction

This feature enhances the existing marketplace package system so that packages are scoped to specific listing categories. Sellers can purchase multiple packages for different categories, apply a package when creating or posting a listing in that category, and receive clear warnings when deleting or deactivating a listing that has a non-recoverable package applied. The system must handle edge cases such as expired packages, fully consumed packages, and concurrent usage.

## Glossary

- **Seller**: A registered marketplace user who creates and manages product listings.
- **Listing**: A product advertisement (ProductListing) created by a Seller within a specific Category.
- **Category**: A classification group (Category document) to which a Listing belongs.
- **Package**: An AdPackage record defining a purchasable bundle (type: `featured_ads` or `ad_slots`) with a name, duration, quantity, and pricing.
- **Purchase**: A PackagePurchase record tracking a Seller's acquisition of a Package for a specific Category, including remainingQuantity and expiry.
- **Package_Application**: The act of associating an active, non-expired Purchase with a Listing at creation or posting time, which permanently decrements the Purchase's remainingQuantity by one.
- **Remaining_Quantity**: The number of unused units left on a Purchase; decremented on Package_Application and never restored.
- **Available_Package**: A Purchase that has paymentStatus "completed", remainingQuantity greater than zero, expiresAt in the future, and a categoryId matching the Listing's categoryId.
- **Confirmation_Modal**: A UI dialog shown to the Seller before deleting or deactivating a Listing that has a Package_Application, warning that the consumed package unit is non-recoverable.
- **Event_Tracking**: The system-wide activity tracking infrastructure comprising the UserAction enum (backend), TrackingEvent constants (frontend), ActivityTrackerService (web), and UserActivity schema (MongoDB). Each tracked event records the action type, userId, optional productListingId, optional categoryId, a metadata map of event-specific key-value pairs, IP address, user agent, and sessionId.
- **Backend_API**: The NestJS server exposing REST endpoints for package and listing operations.
- **Web_Frontend**: The Angular web application used by Sellers.
- **Mobile_App**: The Flutter mobile application used by Sellers.

## Requirements

### Requirement 1: Category-Scoped Package Purchase

**User Story:** As a Seller, I want to purchase packages for specific categories, so that I can boost or extend my posting capacity in the categories I care about.

#### Acceptance Criteria

1. WHEN a Seller initiates a package purchase and provides a categoryId, THE Backend_API SHALL create a Purchase record with the categoryId set to the provided category.
2. WHEN a Seller initiates a package purchase and the selected Package has a categoryPricing entry matching the provided categoryId, THE Backend_API SHALL use the category-specific price instead of the defaultPrice.
3. WHEN a Seller initiates a package purchase and the selected Package has no categoryPricing entry for the provided categoryId, THE Backend_API SHALL use the defaultPrice.
4. THE Backend_API SHALL allow a Seller to hold multiple active Purchases for the same Category and Package type simultaneously.
5. WHEN a Seller views available packages on the Web_Frontend, THE Web_Frontend SHALL display category-specific pricing when a category is selected.
6. WHEN a Seller views available packages on the Mobile_App, THE Mobile_App SHALL display category-specific pricing when a category is selected.

### Requirement 2: Available Packages for Listing Category

**User Story:** As a Seller, I want to see which of my purchased packages are available for a listing's category when creating or editing a listing, so that I can choose which package to apply.

#### Acceptance Criteria

1. WHEN a Seller creates or edits a Listing, THE Backend_API SHALL provide an endpoint that returns all Available_Packages for the Seller filtered by the Listing's categoryId.
2. THE Backend_API SHALL only return Purchases where paymentStatus is "completed", remainingQuantity is greater than zero, and expiresAt is in the future.
3. THE Backend_API SHALL only return Purchases whose categoryId matches the Listing's categoryId.
4. WHEN a Seller is on the listing creation form, THE Web_Frontend SHALL display the list of Available_Packages for the selected category with package name, type, remaining quantity, and expiry date.
5. WHEN a Seller is on the listing creation form, THE Mobile_App SHALL display the list of Available_Packages for the selected category with package name, type, remaining quantity, and expiry date.
6. WHEN no Available_Packages exist for the selected category, THE Web_Frontend SHALL display a message indicating no packages are available and offer a link to purchase packages.
7. WHEN no Available_Packages exist for the selected category, THE Mobile_App SHALL display a message indicating no packages are available and offer a link to purchase packages.

### Requirement 3: Apply Package to Listing

**User Story:** As a Seller, I want to apply one of my available packages to a listing when posting it, so that the listing benefits from the package (featured boost or extra ad slot).

#### Acceptance Criteria

1. WHEN a Seller submits a new Listing with a selected purchaseId, THE Backend_API SHALL validate that the Purchase is an Available_Package for the Listing's categoryId.
2. WHEN the Purchase is valid, THE Backend_API SHALL decrement the Purchase's remainingQuantity by one.
3. WHEN the Purchase is valid, THE Backend_API SHALL store the purchaseId on the Listing record to track the Package_Application.
4. WHEN the Package type is "featured_ads", THE Backend_API SHALL set the Listing's isFeatured flag to true and featuredUntil to the Purchase's expiresAt.
5. WHEN the Package type is "ad_slots", THE Backend_API SHALL count the applied ad_slots Purchase toward the Seller's effective ad limit for that Category.
6. IF the provided purchaseId does not correspond to an Available_Package for the Listing's categoryId, THEN THE Backend_API SHALL reject the request with a descriptive error message.
7. IF the Purchase's remainingQuantity is zero, THEN THE Backend_API SHALL reject the request with a message indicating the package is fully used.
8. IF the Purchase has expired, THEN THE Backend_API SHALL reject the request with a message indicating the package has expired.

### Requirement 4: Permanent Package Consumption

**User Story:** As a Seller, I want to understand that once a package is applied to a listing, the consumed unit is permanent, so that I make informed decisions about package usage.

#### Acceptance Criteria

1. WHEN a Listing with a Package_Application is deleted, THE Backend_API SHALL NOT restore the consumed unit to the Purchase's remainingQuantity.
2. WHEN a Listing with a Package_Application is deactivated (status changed to "inactive"), THE Backend_API SHALL NOT restore the consumed unit to the Purchase's remainingQuantity.
3. WHEN a Listing with a Package_Application is marked as "sold", THE Backend_API SHALL NOT restore the consumed unit to the Purchase's remainingQuantity.
4. THE Backend_API SHALL treat the remainingQuantity decrement as a write-once operation that occurs only at the time of Package_Application.

### Requirement 5: Confirmation Modal for Delete/Deactivate

**User Story:** As a Seller, I want to be warned before deleting or deactivating a listing that has a package applied, so that I do not accidentally lose a non-recoverable package unit.

#### Acceptance Criteria

1. WHEN a Seller requests to delete a Listing that has a Package_Application, THE Web_Frontend SHALL display a Confirmation_Modal stating the package name, type, and that the consumed unit is non-recoverable.
2. WHEN a Seller requests to deactivate a Listing that has a Package_Application, THE Web_Frontend SHALL display a Confirmation_Modal stating the package name, type, and that the consumed unit is non-recoverable.
3. WHEN a Seller requests to delete a Listing that has a Package_Application, THE Mobile_App SHALL display a Confirmation_Modal stating the package name, type, and that the consumed unit is non-recoverable.
4. WHEN a Seller requests to deactivate a Listing that has a Package_Application, THE Mobile_App SHALL display a Confirmation_Modal stating the package name, type, and that the consumed unit is non-recoverable.
5. WHEN the Seller confirms the action in the Confirmation_Modal, THE Web_Frontend SHALL proceed with the delete or deactivate operation.
6. WHEN the Seller cancels the action in the Confirmation_Modal, THE Web_Frontend SHALL abort the operation and return the Seller to the listing view.
7. WHEN the Seller confirms the action in the Confirmation_Modal, THE Mobile_App SHALL proceed with the delete or deactivate operation.
8. WHEN the Seller cancels the action in the Confirmation_Modal, THE Mobile_App SHALL abort the operation and return the Seller to the listing view.
9. WHEN a Listing does not have a Package_Application, THE Web_Frontend SHALL proceed with delete or deactivate without showing the Confirmation_Modal.
10. WHEN a Listing does not have a Package_Application, THE Mobile_App SHALL proceed with delete or deactivate without showing the Confirmation_Modal.

### Requirement 6: Package Information on Listing Detail

**User Story:** As a Seller, I want to see which package is applied to my listing, so that I can track my package usage.

#### Acceptance Criteria

1. WHEN a Seller views their own Listing detail, THE Backend_API SHALL return the applied Package_Application details including the package name, type, and remaining quantity of the associated Purchase.
2. WHEN a Seller views their own Listing detail on the Web_Frontend, THE Web_Frontend SHALL display a badge or indicator showing the applied package name and type.
3. WHEN a Seller views their own Listing detail on the Mobile_App, THE Mobile_App SHALL display a badge or indicator showing the applied package name and type.
4. WHEN a Listing has no Package_Application, THE Backend_API SHALL return null for the package application field.

### Requirement 7: Edge Case Handling

**User Story:** As a Seller, I want the system to handle edge cases gracefully, so that I have a reliable experience when using packages.

#### Acceptance Criteria

1. WHEN a Seller attempts to apply a Package whose Purchase has expired between the time of listing form load and submission, THE Backend_API SHALL reject the request with a message indicating the package has expired.
2. WHEN a Seller attempts to apply a Package whose remainingQuantity reached zero between the time of listing form load and submission, THE Backend_API SHALL reject the request with a message indicating the package is fully used.
3. WHEN multiple Purchases exist for the same Category, THE Backend_API SHALL return all Available_Packages sorted by expiresAt ascending so the soonest-expiring package appears first.
4. WHEN a Purchase expires while a Listing with that Package_Application is still active and of type "featured_ads", THE Backend_API SHALL unflag the Listing's isFeatured status via the existing hourly cron job.
5. IF a concurrent request attempts to apply the same Purchase unit simultaneously, THEN THE Backend_API SHALL use atomic database operations to prevent over-decrementing remainingQuantity below zero.

### Requirement 8: My Packages View Enhancement

**User Story:** As a Seller, I want to see my purchased packages grouped or filterable by category, so that I can easily track usage per category.

#### Acceptance Criteria

1. WHEN a Seller views the "My Packages" page, THE Backend_API SHALL return Purchase records with the associated Category name populated.
2. WHEN a Seller views the "My Packages" page on the Web_Frontend, THE Web_Frontend SHALL allow filtering Purchases by Category.
3. WHEN a Seller views the "My Packages" page on the Mobile_App, THE Mobile_App SHALL allow filtering Purchases by Category.
4. THE Web_Frontend SHALL display the remainingQuantity and total quantity for each Purchase so the Seller can see usage at a glance.
5. THE Mobile_App SHALL display the remainingQuantity and total quantity for each Purchase so the Seller can see usage at a glance.

### Requirement 9: Comprehensive Event Tracking for Category-Package Actions

**User Story:** As a product analyst, I want every meaningful user and system action related to category-scoped packages to be tracked with rich metadata, so that I can build conversion funnels, debug issues, and measure feature adoption.

#### Acceptance Criteria

1. WHEN a Seller selects a Package to apply during listing creation, THE Web_Frontend SHALL fire a PACKAGE_APPLY event with metadata containing purchaseId, packageType, categoryId, and listingId.
2. WHEN a Seller selects a Package to apply during listing creation, THE Mobile_App SHALL fire a PACKAGE_APPLY event with metadata containing purchaseId, packageType, categoryId, and listingId.
3. WHEN the Backend_API successfully applies a Package to a Listing, THE Backend_API SHALL record a PACKAGE_APPLY_SUCCESS event with metadata containing purchaseId, packageType, categoryId, listingId, and remainingQuantityAfter.
4. IF a Package_Application fails because the Purchase has expired, THEN THE Backend_API SHALL record a PACKAGE_APPLY_FAILED event with metadata containing purchaseId, categoryId, listingId, and reason set to "expired".
5. IF a Package_Application fails because the Purchase remainingQuantity is zero, THEN THE Backend_API SHALL record a PACKAGE_APPLY_FAILED event with metadata containing purchaseId, categoryId, listingId, and reason set to "fully_used".
6. IF a Package_Application fails because the Purchase categoryId does not match the Listing categoryId, THEN THE Backend_API SHALL record a PACKAGE_APPLY_FAILED event with metadata containing purchaseId, purchaseCategoryId, listingCategoryId, and reason set to "category_mismatch".
7. WHEN a Seller views the Available_Packages list during listing creation, THE Web_Frontend SHALL fire a PACKAGE_LIST_VIEWED event with metadata containing categoryId and availablePackageCount.
8. WHEN a Seller views the Available_Packages list during listing creation, THE Mobile_App SHALL fire a PACKAGE_LIST_VIEWED event with metadata containing categoryId and availablePackageCount.
9. WHEN the Confirmation_Modal is displayed for deleting a Listing with a Package_Application, THE Web_Frontend SHALL fire a PACKAGE_CONFIRM_MODAL_SHOWN event with metadata containing listingId, purchaseId, packageType, and actionType set to "delete".
10. WHEN the Confirmation_Modal is displayed for deactivating a Listing with a Package_Application, THE Web_Frontend SHALL fire a PACKAGE_CONFIRM_MODAL_SHOWN event with metadata containing listingId, purchaseId, packageType, and actionType set to "deactivate".
11. WHEN the Confirmation_Modal is displayed for deleting a Listing with a Package_Application, THE Mobile_App SHALL fire a PACKAGE_CONFIRM_MODAL_SHOWN event with metadata containing listingId, purchaseId, packageType, and actionType set to "delete".
12. WHEN the Confirmation_Modal is displayed for deactivating a Listing with a Package_Application, THE Mobile_App SHALL fire a PACKAGE_CONFIRM_MODAL_SHOWN event with metadata containing listingId, purchaseId, packageType, and actionType set to "deactivate".
13. WHEN the Seller confirms the action in the Confirmation_Modal, THE Web_Frontend SHALL fire a PACKAGE_CONFIRM_MODAL_CONFIRMED event with metadata containing listingId, purchaseId, packageType, and actionType.
14. WHEN the Seller cancels the action in the Confirmation_Modal, THE Web_Frontend SHALL fire a PACKAGE_CONFIRM_MODAL_CANCELLED event with metadata containing listingId, purchaseId, packageType, and actionType.
15. WHEN the Seller confirms the action in the Confirmation_Modal, THE Mobile_App SHALL fire a PACKAGE_CONFIRM_MODAL_CONFIRMED event with metadata containing listingId, purchaseId, packageType, and actionType.
16. WHEN the Seller cancels the action in the Confirmation_Modal, THE Mobile_App SHALL fire a PACKAGE_CONFIRM_MODAL_CANCELLED event with metadata containing listingId, purchaseId, packageType, and actionType.
17. WHEN the hourly cron job detects that a Purchase has expired, THE Backend_API SHALL record a PACKAGE_EXPIRED event with metadata containing purchaseId, categoryId, packageType, sellerId, and remainingQuantityAtExpiry.
18. WHEN a Seller views the "My Packages" page, THE Web_Frontend SHALL fire a MY_PACKAGES_VIEWED event with metadata containing the applied categoryId filter or "all" when no filter is applied.
19. WHEN a Seller views the "My Packages" page, THE Mobile_App SHALL fire a MY_PACKAGES_VIEWED event with metadata containing the applied categoryId filter or "all" when no filter is applied.
20. WHEN a Seller applies a category filter on the "My Packages" page, THE Web_Frontend SHALL fire a MY_PACKAGES_FILTER_CHANGED event with metadata containing the selected categoryId and resultCount.
21. WHEN a Seller applies a category filter on the "My Packages" page, THE Mobile_App SHALL fire a MY_PACKAGES_FILTER_CHANGED event with metadata containing the selected categoryId and resultCount.
22. WHEN a Seller initiates a package purchase for a specific category, THE Web_Frontend SHALL fire a PACKAGE_PURCHASE_INITIATED event with metadata containing packageId, categoryId, packageType, and price.
23. WHEN a Seller initiates a package purchase for a specific category, THE Mobile_App SHALL fire a PACKAGE_PURCHASE_INITIATED event with metadata containing packageId, categoryId, packageType, and price.
24. WHEN a Listing with a Package_Application is deleted, THE Backend_API SHALL record a PACKAGED_LISTING_DELETED event with metadata containing listingId, purchaseId, packageType, categoryId, and remainingQuantityOnPurchase.
25. WHEN a Listing with a Package_Application is deactivated, THE Backend_API SHALL record a PACKAGED_LISTING_DEACTIVATED event with metadata containing listingId, purchaseId, packageType, categoryId, and remainingQuantityOnPurchase.
26. WHEN a Listing with a Package_Application is marked as "sold", THE Backend_API SHALL record a PACKAGED_LISTING_SOLD event with metadata containing listingId, purchaseId, packageType, and categoryId.
27. WHEN no Available_Packages exist for the selected category during listing creation, THE Web_Frontend SHALL fire a PACKAGE_NONE_AVAILABLE event with metadata containing categoryId.
28. WHEN no Available_Packages exist for the selected category during listing creation, THE Mobile_App SHALL fire a PACKAGE_NONE_AVAILABLE event with metadata containing categoryId.
29. WHEN a Seller clicks the "purchase packages" link from the empty Available_Packages state, THE Web_Frontend SHALL fire a PACKAGE_PURCHASE_CTA_CLICKED event with metadata containing categoryId and source set to "listing_creation".
30. WHEN a Seller clicks the "purchase packages" link from the empty Available_Packages state, THE Mobile_App SHALL fire a PACKAGE_PURCHASE_CTA_CLICKED event with metadata containing categoryId and source set to "listing_creation".
31. THE Backend_API SHALL register all new package-related event types in the UserAction enum so that Event_Tracking records are queryable by action type.
32. THE Web_Frontend SHALL register all new package-related event types in the TrackingEvent constant object so that the ActivityTrackerService can fire the events.
33. THE Mobile_App SHALL register all new package-related event types in the mobile tracking constants so that the mobile tracking service can fire the events.
34. THE Backend_API SHALL include categoryId on all package-related Event_Tracking records to enable per-category analytics queries.
