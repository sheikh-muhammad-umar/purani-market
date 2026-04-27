# Implementation Plan: Category-Package Management

## Overview

Implement category-scoped package lifecycle management across the NestJS backend, Angular web frontend, and Flutter mobile app. The implementation proceeds bottom-up: schema changes → backend service logic → API endpoints → web frontend → mobile frontend → event tracking → final wiring.

## Tasks

- [x] 1. Backend schema changes and indexes
  - [x] 1.1 Add `purchaseId` field to ProductListing schema
    - Add `@Prop({ type: Types.ObjectId, ref: 'PackagePurchase', default: null }) purchaseId` to `backend/src/listings/schemas/product-listing.schema.ts`
    - Add index `ProductListingSchema.index({ purchaseId: 1 })`
    - _Requirements: 3.3, 6.1_
  - [x] 1.2 Add compound index to PackagePurchase schema for available-packages query
    - Add index `{ sellerId: 1, categoryId: 1, paymentStatus: 1, remainingQuantity: 1, expiresAt: 1 }` to `backend/src/packages/schemas/package-purchase.schema.ts`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Backend service: available packages and package application
  - [x] 2.1 Implement `getAvailablePackages` in PackagesService
    - Add method `getAvailablePackages(sellerId: string, categoryId: string)` to `backend/src/packages/packages.service.ts`
    - Query PackagePurchase where `sellerId` matches, `categoryId` matches, `paymentStatus` is `"completed"`, `remainingQuantity > 0`, and `expiresAt > now`
    - Sort results by `expiresAt` ascending (soonest-expiring first)
    - Populate `packageId` with `name` and `type`
    - _Requirements: 2.1, 2.2, 2.3, 7.3_
  - [x] 2.2 Write property test for available packages filter correctness
    - **Property 2: Available Packages Filter Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3**
  - [x] 2.3 Write property test for available packages sort order
    - **Property 3: Available Packages Sort Order**
    - **Validates: Requirements 7.3**
  - [x] 2.4 Implement `applyPackageToListing` in PackagesService
    - Add method `applyPackageToListing(purchaseId: string, sellerId: string, categoryId: string)` to `backend/src/packages/packages.service.ts`
    - Validate the purchase exists, belongs to the seller, has `categoryId` matching the listing's category, `paymentStatus` is `"completed"`, `remainingQuantity > 0`, and `expiresAt > now`
    - Use atomic `findOneAndUpdate` with filter `{ _id: purchaseId, sellerId, categoryId, paymentStatus: 'completed', remainingQuantity: { $gt: 0 }, expiresAt: { $gt: now } }` and update `{ $inc: { remainingQuantity: -1 } }` to prevent concurrent over-decrement
    - Return the updated purchase and populated package document
    - Throw `BadRequestException` with descriptive messages for category mismatch, expired, fully used, or not found cases
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8, 7.1, 7.2, 7.5_
  - [x] 2.5 Write property test for successful package application invariants
    - **Property 4: Successful Package Application Invariants**
    - **Validates: Requirements 3.2, 3.3, 3.4**
  - [x] 2.6 Write property test for category mismatch rejection
    - **Property 5: Category Mismatch Rejection**
    - **Validates: Requirements 3.1, 3.6**
  - [x] 2.7 Write property test for atomic non-negative quantity
    - **Property 7: Atomic Non-Negative Quantity**
    - **Validates: Requirements 7.5, 3.7**

- [x] 3. Backend service: price resolution and purchase modifications
  - [x] 3.1 Implement category-specific price resolution in purchase flow
    - Modify the purchase creation logic in `backend/src/packages/packages.service.ts` to resolve price from `AdPackage.categoryPricing` when a matching `categoryId` entry exists, otherwise use `defaultPrice`
    - Ensure the `categoryId` is stored on the `PackagePurchase` record
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 3.2 Write property test for price resolution correctness
    - **Property 1: Price Resolution Correctness**
    - **Validates: Requirements 1.2, 1.3**

- [x] 4. Backend service: listing creation and detail modifications
  - [x] 4.1 Modify `createListing` in ListingsService to accept and apply packages
    - Update `backend/src/listings/dto/create-listing.dto.ts` to add optional `purchaseId` field with `@IsOptional()` and `@IsMongoId()` validators
    - Modify `createListing` in `backend/src/listings/listings.service.ts` to call `PackagesService.applyPackageToListing()` when `purchaseId` is provided
    - Set `isFeatured = true` and `featuredUntil = purchase.expiresAt` when package type is `featured_ads`
    - Store `purchaseId` on the created listing document
    - Inject `PackagesService` into `ListingsService` (update `backend/src/listings/listings.module.ts` to import `PackagesModule`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 4.2 Modify listing detail endpoint to populate package application details
    - Update the `GET /api/listings/:id` handler in `backend/src/listings/listings.service.ts` to populate `purchaseId` with package name, type, and remaining quantity when the listing has a `purchaseId`
    - Return `null` for the package application field when no `purchaseId` exists
    - _Requirements: 6.1, 6.4_
  - [x] 4.3 Write property test for permanent consumption (non-restoration)
    - **Property 6: Permanent Consumption (Non-Restoration)**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 5. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend API: available packages endpoint and my-purchases filter
  - [x] 6.1 Add `GET /api/packages/available` endpoint
    - Add route handler in `backend/src/packages/packages.controller.ts` with `@Get('available')` decorator
    - Accept `categoryId` as a required query parameter (validated with `@IsMongoId()`)
    - Extract `sellerId` from JWT token
    - Call `PackagesService.getAvailablePackages(sellerId, categoryId)`
    - _Requirements: 2.1_
  - [x] 6.2 Modify `GET /api/packages/my-purchases` to support category filtering
    - Add optional `categoryId` query parameter to the existing my-purchases endpoint in `backend/src/packages/packages.controller.ts`
    - Modify `getMyPurchases` in `backend/src/packages/packages.service.ts` to accept optional `categoryId` filter
    - Populate `categoryId` with category `name` and populate `packageId` with `name` and `type`
    - _Requirements: 8.1_

- [x] 7. Backend event tracking: register new UserAction enum values
  - [x] 7.1 Add new event types to UserAction enum and wire tracking calls
    - Add `PACKAGE_APPLY_SUCCESS`, `PACKAGE_APPLY_FAILED`, `PACKAGE_EXPIRED`, `PACKAGED_LISTING_DELETED`, `PACKAGED_LISTING_DEACTIVATED`, `PACKAGED_LISTING_SOLD` to `backend/src/ai/enums/user-action.enum.ts`
    - Add tracking calls in `PackagesService.applyPackageToListing()` for success and failure events with metadata including `purchaseId`, `packageType`, `categoryId`, `listingId`, and `reason` (for failures)
    - Add tracking calls in `ListingsService` for delete/deactivate/sold transitions when the listing has a `purchaseId`, with metadata including `listingId`, `purchaseId`, `packageType`, `categoryId`, and `remainingQuantityOnPurchase`
    - Add `PACKAGE_EXPIRED` tracking in the existing hourly cron job (`handleExpiredFeaturedAds`) with metadata including `purchaseId`, `categoryId`, `packageType`, `sellerId`, and `remainingQuantityAtExpiry`
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.17, 9.24, 9.25, 9.26, 9.31, 9.34_
  - [x] 7.2 Write property test for event categoryId completeness
    - **Property 8: Event CategoryId Completeness**
    - **Validates: Requirements 9.34**

- [x] 8. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Web frontend: available packages component and listing creation integration
  - [x] 9.1 Add new TrackingEvent constants for package events
    - Add `PACKAGE_APPLY`, `PACKAGE_LIST_VIEWED`, `PACKAGE_CONFIRM_MODAL_SHOWN`, `PACKAGE_CONFIRM_MODAL_CONFIRMED`, `PACKAGE_CONFIRM_MODAL_CANCELLED`, `PACKAGE_NONE_AVAILABLE`, `PACKAGE_PURCHASE_CTA_CLICKED`, `PACKAGE_PURCHASE_INITIATED`, `MY_PACKAGES_VIEWED`, `MY_PACKAGES_FILTER_CHANGED` to `web/src/app/core/enums/tracking-events.ts`
    - _Requirements: 9.32_
  - [x] 9.2 Add `getAvailablePackages(categoryId)` method to web PackagesService
    - Add method to `web/src/app/core/services/packages.service.ts` that calls `GET /api/packages/available?categoryId=X`
    - _Requirements: 2.4_
  - [x] 9.3 Create AvailablePackagesComponent for listing creation form
    - Create new component at `web/src/app/features/listings/create-listing/available-packages/`
    - Accept `categoryId` as input, fetch available packages via `PackagesService.getAvailablePackages()`
    - Display package name, type, remaining quantity, and expiry date for each available package
    - Emit selected `purchaseId` to parent form
    - Show "no packages available" message with link to purchase packages when list is empty
    - Fire `PACKAGE_LIST_VIEWED` event on load with `categoryId` and `availablePackageCount`
    - Fire `PACKAGE_NONE_AVAILABLE` event when no packages exist with `categoryId`
    - Fire `PACKAGE_PURCHASE_CTA_CLICKED` event when purchase link is clicked with `categoryId` and `source: "listing_creation"`
    - Fire `PACKAGE_APPLY` event when a package is selected with `purchaseId`, `packageType`, `categoryId`, and `listingId`
    - _Requirements: 2.4, 2.6, 9.1, 9.7, 9.27, 9.29_
  - [x] 9.4 Integrate AvailablePackagesComponent into create-listing form
    - Modify `web/src/app/features/listings/create-listing/create-listing.component.ts` and its template to include the AvailablePackagesComponent
    - Pass the selected `categoryId` to the component and include the emitted `purchaseId` in the listing creation payload
    - Handle package application errors from the API (display error, refresh available packages)
    - _Requirements: 2.4, 3.1_

- [x] 10. Web frontend: confirmation modal for delete/deactivate
  - [x] 10.1 Create or extend ConfirmationModalComponent for package warnings
    - Create a reusable modal component at `web/src/app/shared/` (or extend existing) that accepts package details (name, type) and action type ("delete" | "deactivate")
    - Display warning that the consumed package unit is non-recoverable
    - Return confirm/cancel result to the caller
    - _Requirements: 5.1, 5.2_
  - [x] 10.2 Integrate confirmation modal into my-listings and listing-detail views
    - Modify delete/deactivate actions in `web/src/app/features/listings/my-listings/my-listings.component.ts` and `web/src/app/features/listings/listing-detail/listing-detail.component.ts`
    - Before delete/deactivate, check if the listing has a `purchaseId`; if so, show the confirmation modal
    - On confirm, proceed with the operation; on cancel, abort
    - Skip modal when listing has no `purchaseId`
    - Fire `PACKAGE_CONFIRM_MODAL_SHOWN` event when modal is displayed with `listingId`, `purchaseId`, `packageType`, and `actionType`
    - Fire `PACKAGE_CONFIRM_MODAL_CONFIRMED` or `PACKAGE_CONFIRM_MODAL_CANCELLED` events accordingly
    - _Requirements: 5.1, 5.2, 5.5, 5.6, 5.9, 9.9, 9.10, 9.13, 9.14_

- [x] 11. Web frontend: listing detail package badge and My Packages enhancements
  - [x] 11.1 Display package application badge on listing detail
    - Modify `web/src/app/features/listings/listing-detail/listing-detail.component.ts` and its template to display a badge/indicator showing the applied package name and type when the listing has a `purchaseId`
    - _Requirements: 6.2_
  - [x] 11.2 Add category filter to My Packages page
    - Modify `web/src/app/features/packages/my-packages/my-packages.component.ts` and its template to add a category filter dropdown
    - Fetch categories from the existing categories service
    - Pass `categoryId` query parameter to `GET /api/packages/my-purchases`
    - Display `remainingQuantity` and total `quantity` for each purchase
    - Fire `MY_PACKAGES_VIEWED` event on page load with the applied filter or `"all"`
    - Fire `MY_PACKAGES_FILTER_CHANGED` event when filter changes with `categoryId` and `resultCount`
    - _Requirements: 8.2, 8.4, 9.18, 9.20_
  - [x] 11.3 Display category-specific pricing in package list
    - Modify `web/src/app/features/packages/package-list/package-list.component.ts` and its template to show category-specific price when a category is selected, falling back to `defaultPrice`
    - Fire `PACKAGE_PURCHASE_INITIATED` event when purchase is initiated with `packageId`, `categoryId`, `packageType`, and `price`
    - _Requirements: 1.5, 9.22_

- [x] 12. Checkpoint - Ensure all web frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Mobile app: available packages widget and listing creation integration
  - [x] 13.1 Add new tracking event constants for mobile
    - Add package-related tracking event constants to `mobile/lib/utils/constants.dart` mirroring the web constants: `PACKAGE_APPLY`, `PACKAGE_LIST_VIEWED`, `PACKAGE_CONFIRM_MODAL_SHOWN`, `PACKAGE_CONFIRM_MODAL_CONFIRMED`, `PACKAGE_CONFIRM_MODAL_CANCELLED`, `PACKAGE_NONE_AVAILABLE`, `PACKAGE_PURCHASE_CTA_CLICKED`, `PACKAGE_PURCHASE_INITIATED`, `MY_PACKAGES_VIEWED`, `MY_PACKAGES_FILTER_CHANGED`
    - _Requirements: 9.33_
  - [x] 13.2 Add `loadAvailablePackages(categoryId)` to PackagesProvider
    - Modify `mobile/lib/features/packages/packages_provider.dart` to add a method that calls `GET /api/packages/available?categoryId=X`
    - Add `categoryFilter` state for My Packages filtering
    - _Requirements: 2.5, 8.3_
  - [x] 13.3 Create AvailablePackagesWidget for listing creation
    - Create a new Flutter widget in `mobile/lib/features/listings/` that displays available packages for the selected category
    - Show package name, type, remaining quantity, and expiry date
    - Allow selection of a package and emit the `purchaseId`
    - Show "no packages available" message with link to purchase packages when list is empty
    - Fire `PACKAGE_LIST_VIEWED`, `PACKAGE_NONE_AVAILABLE`, `PACKAGE_PURCHASE_CTA_CLICKED`, and `PACKAGE_APPLY` events with appropriate metadata
    - _Requirements: 2.5, 2.7, 9.2, 9.8, 9.28, 9.30_
  - [x] 13.4 Integrate AvailablePackagesWidget into create listing screen
    - Modify `mobile/lib/features/listings/create_listing_screen.dart` and `mobile/lib/features/listings/create_listing_provider.dart` to include the widget
    - Pass selected `categoryId` and include emitted `purchaseId` in the listing creation payload
    - Handle package application errors from the API
    - _Requirements: 2.5, 3.1_

- [x] 14. Mobile app: confirmation dialog and listing detail enhancements
  - [x] 14.1 Create ConfirmationDialog for package warnings
    - Create a dialog widget in `mobile/lib/widgets/` that accepts package details and action type
    - Display warning that the consumed package unit is non-recoverable
    - Return confirm/cancel result
    - _Requirements: 5.3, 5.4_
  - [x] 14.2 Integrate confirmation dialog into seller dashboard and listing detail
    - Modify delete/deactivate actions in `mobile/lib/features/listings/seller_dashboard_screen.dart` and `mobile/lib/features/listings/listing_detail_screen.dart`
    - Check if listing has `purchaseId`; if so, show confirmation dialog before proceeding
    - Skip dialog when listing has no `purchaseId`
    - Fire `PACKAGE_CONFIRM_MODAL_SHOWN`, `PACKAGE_CONFIRM_MODAL_CONFIRMED`, and `PACKAGE_CONFIRM_MODAL_CANCELLED` events with appropriate metadata
    - _Requirements: 5.3, 5.4, 5.7, 5.8, 5.10, 9.11, 9.12, 9.15, 9.16_
  - [x] 14.3 Display package badge on listing detail screen
    - Modify `mobile/lib/features/listings/listing_detail_screen.dart` to show a badge/indicator with the applied package name and type
    - _Requirements: 6.3_
  - [x] 14.4 Add category filter and usage display to My Packages screen
    - Modify `mobile/lib/features/packages/packages_screen.dart` to add a category filter dropdown
    - Display `remainingQuantity` and total `quantity` for each purchase
    - Fire `MY_PACKAGES_VIEWED` and `MY_PACKAGES_FILTER_CHANGED` events with appropriate metadata
    - _Requirements: 8.3, 8.5, 9.19, 9.21_
  - [x] 14.5 Display category-specific pricing in mobile package list
    - Modify the package list/purchase flow in `mobile/lib/features/packages/packages_screen.dart` to show category-specific price when a category is selected
    - Fire `PACKAGE_PURCHASE_INITIATED` event with `packageId`, `categoryId`, `packageType`, and `price`
    - _Requirements: 1.6, 9.23_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- The backend uses atomic `findOneAndUpdate` for concurrency safety — no distributed locks needed
- Permanent consumption is enforced by the absence of any restoration logic (no code restores `remainingQuantity`)
