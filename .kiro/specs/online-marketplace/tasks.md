# Implementation Plan: Online Marketplace

## Overview

This plan implements an OLX-like marketplace with NestJS backend, Angular web frontend, and Flutter mobile app. Tasks are ordered to build foundational infrastructure first, then core features, then advanced features, and finally integration/deployment. Each task builds incrementally on previous work.

## Tasks

- [x] 1. Set up project structure and core infrastructure
  - [x] 1.1 Initialize NestJS backend project with module structure
    - Create NestJS project with TypeScript strict mode
    - Set up `src/` directory structure: `common/`, `auth/`, `users/`, `categories/`, `listings/`, `search/`, `packages/`, `payments/`, `messaging/`, `notifications/`, `location/`, `reviews/`, `ai/`, `favorites/`, `admin/`
    - Configure MongoDB connection via Mongoose
    - Configure Redis connection (caching, sessions, rate limiting)
    - Configure Elasticsearch client
    - Set up environment configuration (`.env` for dev/staging/prod)
    - _Requirements: 21.1, 23.3_

  - [x] 1.2 Implement common guards, decorators, filters, and middleware
    - Create `JwtAuthGuard`, `RolesGuard`, `ThrottlerGuard` in `common/guards/`
    - Create `@Roles()` and `@CurrentUser()` decorators in `common/decorators/`
    - Create `HttpExceptionFilter` in `common/filters/`
    - Create `TransformInterceptor` and `LoggingInterceptor` in `common/interceptors/`
    - Create `ValidationPipe` in `common/pipes/`
    - Configure CORS middleware (allow only registered client domains) and CSRF middleware
    - _Requirements: 6.1, 6.2, 6.3, 21.3, 21.4, 21.5, 22.1, 22.3, 22.4_

  - [x] 1.3 Write unit tests for guards, decorators, and middleware
    - Test `RolesGuard` enforces role-based access correctly
    - Test `JwtAuthGuard` rejects invalid/expired tokens
    - Test `ThrottlerGuard` rate limiting behavior
    - Test CORS and CSRF middleware
    - _Requirements: 6.1, 6.2, 6.3, 21.4, 21.5_

  - [x] 1.4 Initialize Angular web frontend project
    - Create Angular project with routing, lazy-loaded feature modules
    - Set up `core/` (AuthService, AuthGuard, JWT interceptor, ApiService, WebSocketService), `shared/` (components, pipes), and `features/` module structure
    - Define TypeScript interfaces for all entities (User, Listing, Category, Package, Message, Review, Favorite) in `core/models/`
    - Configure design system: teal/coral color palette, Inter typography, 8px grid, elevation/shadow tokens, responsive breakpoints, dark mode CSS variables
    - _Requirements: 16.2_

  - [x] 1.5 Initialize Flutter mobile project
    - Create Flutter project targeting iOS, Android, and Huawei
    - Set up `lib/` directory structure: `core/`, `models/`, `providers/`, `features/`, `widgets/`, `utils/`
    - Define Dart model classes for all entities
    - Configure state management (Riverpod or Bloc)
    - Set up Hive/SQLite for offline caching
    - Configure design system tokens matching web (colors, typography, spacing)
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 2. Checkpoint - Ensure project scaffolding compiles and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement User Authentication module
  - [x] 3.1 Create User schema and Users module
    - Implement `user.schema.ts` with all fields from the User data model (profile, socialLogins, mfa, pendingEmailChange, pendingPhoneChange, verificationChangeCount, deviceTokens, notificationPreferences, etc.)
    - Create `users.module.ts`, `users.service.ts`, `users.controller.ts`
    - Implement `GET /api/users/me` and `PATCH /api/users/me` endpoints
    - Add indexes: `{ email: 1 }`, `{ phone: 1 }`, `{ "socialLogins.provider": 1, "socialLogins.providerId": 1 }`
    - _Requirements: 1.1, 1.2, 2.4_

  - [x] 3.2 Implement registration endpoints
    - Implement `POST /api/auth/register` for email registration: create user with `emailVerified: false`, send verification email with unique link (valid 24 hours) within 5 seconds
    - Implement `POST /api/auth/register` for phone registration: create user with `phoneVerified: false`, send 6-digit OTP (valid 10 minutes) within 10 seconds
    - Implement `POST /api/auth/verify-email` to mark email as verified
    - Implement `POST /api/auth/verify-phone` to mark phone as verified
    - Implement `POST /api/auth/resend-verification` with max 5 resends/hour, invalidating previous tokens
    - Implement unverified account reminder (24-hour check) and restricted access for unverified users
    - Validate duplicate email/phone returns error; invalid data returns descriptive validation errors
    - Hash passwords with bcrypt (cost factor 12)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9, 21.2_

  - [x] 3.3 Implement login and JWT token management
    - Implement `POST /api/auth/login` returning JWT access token + refresh token; record login timestamp and device info
    - Implement `POST /api/auth/refresh-token` for token refresh without re-authentication
    - Implement `POST /api/auth/logout` to invalidate tokens (Redis blacklist)
    - Return generic error on invalid credentials (don't reveal which field is wrong)
    - _Requirements: 2.1, 2.3, 2.4, 22.1, 22.2_

  - [x] 3.4 Implement social login (Google, Facebook)
    - Implement `POST /api/auth/social-login` with Google and Facebook OAuth 2.0 strategies
    - Create/link user account on social login; mark email as verified (OAuth provider verified)
    - Return JWT access token on successful social auth
    - _Requirements: 1.7, 2.2_

  - [x] 3.5 Implement MFA (TOTP)
    - Implement `POST /api/auth/mfa/enable` to generate TOTP secret and return QR code
    - Implement `POST /api/auth/mfa/verify` to verify TOTP code during login
    - Implement failed attempt counter: lock account for 30 minutes after 5 failed attempts in 15-minute window
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.6 Implement password recovery
    - Implement `POST /api/auth/forgot-password` to send reset link (valid 30 minutes); return generic success for unregistered emails
    - Implement `POST /api/auth/reset-password` to update password and invalidate all sessions
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 3.7 Implement email and phone change verification
    - Implement `POST /api/auth/change-email` to send verification link to new email (valid 24 hours); current email stays active
    - Implement `POST /api/auth/change-email/verify` to update email, mark verified, invalidate sessions, notify old email
    - Implement `POST /api/auth/change-phone` to send OTP to new phone (valid 10 minutes); current phone stays active
    - Implement `POST /api/auth/change-phone/verify` to update phone, mark verified, invalidate sessions
    - Reject change if new email/phone already in use; discard expired change requests
    - Enforce max 3 change requests per 24 hours per user
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 3.8 Implement rate limiting on auth endpoints
    - Configure ThrottlerGuard: max 10 login attempts per IP per 15-minute window
    - Return 429 Too Many Requests with Retry-After header when exceeded
    - _Requirements: 21.4, 21.5_

  - [x] 3.9 Write unit tests for auth module
    - Test registration flows (email, phone, social)
    - Test verification flows (email link, phone OTP, resend limits)
    - Test login with valid/invalid credentials
    - Test MFA enable/verify/lockout
    - Test password recovery flow
    - Test email/phone change flows with limits
    - Test rate limiting behavior
    - _Requirements: 1.1–1.9, 2.1–2.4, 3.1–3.4, 4.1–4.3, 5.1–5.7, 21.4, 21.5_

- [x] 4. Implement Categories module
  - [x] 4.1 Create Category schema and Categories module
    - Implement `category.schema.ts` with hierarchical structure (parentId, level 1-3), attributes array, filters array, isActive, sortOrder
    - Create `categories.module.ts`, `categories.service.ts`, `categories.controller.ts`
    - Implement `GET /api/categories` (return full category tree) and `GET /api/categories/:id` (with attributes/filters)
    - Add indexes: `{ parentId: 1 }`, `{ slug: 1 }`, `{ level: 1 }`
    - Implement Redis caching for category tree
    - _Requirements: 9.1, 9.3_

  - [x] 4.2 Implement admin category management endpoints
    - Implement `POST /api/categories` (create), `PATCH /api/categories/:id` (update), `DELETE /api/categories/:id` (delete) — Admin only
    - Implement `PATCH /api/categories/:id/attributes` to manage Category_Attributes per category
    - Implement `PATCH /api/categories/:id/filters` to manage Category_Filters per category
    - Invalidate Redis cache on category changes
    - _Requirements: 9.4, 9.5, 9.7_

  - [x] 4.3 Write unit tests for categories module
    - Test hierarchical category CRUD (3 levels)
    - Test attribute and filter management
    - Test cache invalidation
    - _Requirements: 9.1, 9.4, 9.5, 9.7_

- [x] 5. Implement Product Listings module
  - [x] 5.1 Create Product Listing schema and Listings module
    - Implement `product-listing.schema.ts` with all fields: title, description, price, categoryId, categoryPath, condition, categoryAttributes (dynamic Map), images (max 20), video (max 1), location (GeoJSON Point), contactInfo, status, isFeatured, featuredUntil, viewCount, favoriteCount, soft delete
    - Create `listings.module.ts`, `listings.service.ts`, `listings.controller.ts`
    - Add indexes: `{ sellerId: 1 }`, `{ categoryId: 1 }`, `{ status: 1 }`, `{ location: "2dsphere" }`, `{ isFeatured: -1, createdAt: -1 }`, `{ createdAt: -1 }`, `{ categoryPath: 1 }`
    - _Requirements: 7.1, 7.2_

  - [x] 5.2 Implement create listing endpoint with validation
    - Implement `POST /api/listings` (Seller only)
    - Validate required fields: title (max 150), description (max 5000), price (positive), category (up to 3 levels), condition, min 2 media items, location, contact info
    - Dynamically validate category-specific attributes based on selected category's attribute definitions
    - Set status to "Active" or "Pending Review" (if moderation enabled)
    - Check ad limit: reject if seller has reached free limit (10) and no active ad slot packages
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.8, 9.2, 9.6, 26.1, 26.2_

  - [x] 5.3 Implement media upload service
    - Implement `POST /api/listings/:id/media` for image/video upload to S3/GCS via presigned URLs
    - Validate image formats (JPEG, PNG, WebP, max 5MB each) and video format (MP4, max 50MB)
    - Enforce limits: max 20 pictures, max 1 video per ad
    - Implement image compression and thumbnail generation using Sharp
    - _Requirements: 7.3, 7.4, 7.7_

  - [x] 5.4 Implement listing management endpoints
    - Implement `GET /api/listings` (public, paginated) and `GET /api/listings/:id` (public, increment viewCount)
    - Implement `PATCH /api/listings/:id` (Seller owner only) to update fields with modification timestamp
    - Implement `PATCH /api/listings/:id/status` (Seller owner only) to mark as Sold/Reserved; reflect in search within 30 seconds
    - Implement `DELETE /api/listings/:id` (Seller owner or Admin) for soft-delete (retain data 90 days)
    - Return 403 if non-owner/non-admin attempts modification
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.5 Write unit tests for listings module
    - Test create listing with valid/invalid data
    - Test media upload limits and format validation
    - Test listing CRUD operations
    - Test ad limit enforcement
    - Test ownership authorization
    - _Requirements: 7.1–7.8, 8.1–8.4, 26.1, 26.2_

- [x] 6. Checkpoint - Ensure auth, categories, and listings modules work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Search module with Elasticsearch
  - [x] 7.1 Set up Elasticsearch indexing and sync
    - Create Elasticsearch index mapping for product listings (title, description, price, category, location, condition, categoryAttributes, isFeatured)
    - Implement MongoDB change streams to sync product data to Elasticsearch in near real-time
    - Boost Featured_Ads in search scoring
    - _Requirements: 10.1, 27.3_

  - [x] 7.2 Implement search endpoints
    - Implement `GET /api/search` with full-text search, returning results ranked by relevance within 2 seconds, Featured_Ads at top
    - Support filters: price range, category, location (radius from point), date posted, condition
    - Support sorting: price low-to-high, price high-to-low, newest first, relevance
    - Implement `GET /api/search/suggestions` for auto-suggestions based on popular searches and matching titles within 500ms
    - Display "no results found" with related categories/alternative terms when empty
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 7.3 Implement dynamic category-specific filters in search
    - When a category is selected, dynamically apply Category_Filters configured for that category
    - Query Elasticsearch using selected Category_Filters and return only matching listings
    - Cache popular search terms in Redis
    - _Requirements: 10.6, 10.7_

  - [x] 7.4 Write unit tests for search module
    - Test full-text search relevance
    - Test filter combinations
    - Test category-specific dynamic filters
    - Test auto-suggestions
    - Test featured ad boosting
    - _Requirements: 10.1–10.7_

- [x] 8. Implement Favorites module
  - [x] 8.1 Create Favorite schema and Favorites module
    - Implement `favorite.schema.ts` with userId, productListingId, createdAt
    - Create `favorites.module.ts`, `favorites.service.ts`, `favorites.controller.ts`
    - Implement `POST /api/favorites` (add), `GET /api/favorites` (list with current status/price), `DELETE /api/favorites/:id` (remove)
    - Add unique compound index: `{ userId: 1, productListingId: 1 }`
    - Update listing favoriteCount on add/remove
    - _Requirements: 25.1, 25.2, 25.4_

  - [x] 8.2 Write unit tests for favorites module
    - Test add/remove/list favorites
    - Test duplicate prevention
    - _Requirements: 25.1, 25.2, 25.4_

- [x] 9. Implement Reviews module
  - [x] 9.1 Create Review schema and Reviews module
    - Implement `review.schema.ts` with reviewerId, sellerId, productListingId, rating (1-5), text (max 2000), status
    - Create `reviews.module.ts`, `reviews.service.ts`, `reviews.controller.ts`
    - Implement `POST /api/reviews` (Buyer only, must have had conversation with seller about the listing)
    - Implement `GET /api/reviews/listing/:id` and `GET /api/reviews/seller/:id` (public, sorted by most recent)
    - Calculate and return average seller rating
    - Reject review if buyer hasn't interacted with seller on that listing
    - Flag reviews with prohibited content for admin moderation
    - Add unique index: `{ reviewerId: 1, productListingId: 1 }`
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x] 9.2 Write unit tests for reviews module
    - Test review submission with/without prior conversation
    - Test average rating calculation
    - Test content moderation flagging
    - _Requirements: 20.1–20.5_

- [x] 10. Implement Messaging module
  - [x] 10.1 Create Conversation and Message schemas and Messaging module
    - Implement `conversation.schema.ts` and `message.schema.ts`
    - Create `messaging.module.ts`, `messaging.service.ts`, `messaging.controller.ts`
    - Implement `POST /api/conversations` (start conversation on a listing)
    - Implement `GET /api/conversations` (list user's conversations)
    - Implement `GET /api/conversations/:id/messages` (paginated, 20 per page)
    - Add unique compound index on conversations: `{ buyerId: 1, sellerId: 1, productListingId: 1 }`
    - _Requirements: 13.2, 13.4_

  - [x] 10.2 Implement WebSocket gateway for real-time messaging
    - Create `messaging.gateway.ts` using NestJS WebSocket gateway (Socket.IO)
    - Implement real-time message delivery via WebSocket connections
    - Persist messages to MongoDB on send
    - Implement typing indicators and read receipts
    - Block messages with prohibited content and notify sender
    - Trigger push notification for offline users within 10 seconds
    - _Requirements: 13.1, 13.3, 13.5_

  - [x] 10.3 Write unit tests for messaging module
    - Test conversation creation and message persistence
    - Test WebSocket message delivery
    - Test pagination
    - Test content filtering
    - _Requirements: 13.1–13.5_

- [x] 11. Implement Packages and Payments modules
  - [x] 11.1 Create Ad Package and Package Purchase schemas
    - Implement `ad-package.schema.ts` with name, type, duration (7/15/30), quantity, defaultPrice, categoryPricing
    - Implement `package-purchase.schema.ts` with sellerId, packageId, type, quantity, remainingQuantity, duration, price, paymentMethod, paymentStatus, paymentTransactionId, activatedAt, expiresAt
    - Create `packages.module.ts`, `packages.service.ts`, `packages.controller.ts`
    - _Requirements: 28.1, 28.2_

  - [x] 11.2 Implement package listing and purchase endpoints
    - Implement `GET /api/packages` (list available packages) and `GET /api/packages/:id`
    - Implement `POST /api/packages/purchase` (Seller): validate package, redirect to payment gateway
    - Implement `GET /api/packages/my-purchases` (Seller's purchase history)
    - Support purchasing multiple packages simultaneously
    - _Requirements: 28.1, 28.3, 28.4_

  - [x] 11.3 Implement payment gateway integrations
    - Create `payments.module.ts`, `payments.service.ts`, `payments.controller.ts`
    - Implement gateway adapter pattern with `jazzcash.gateway.ts`, `easypaisa.gateway.ts`, `card.gateway.ts`
    - Implement `POST /api/packages/payment-callback` webhook for payment confirmation
    - On successful payment: activate package, update seller's ad slots/featured slots, notify seller
    - On failed payment: record failure, notify seller with reason
    - Encrypt all payment data in transit; never store sensitive credentials
    - _Requirements: 28.4, 28.5, 28.6, 29.1, 29.2, 29.3, 29.4, 29.5_

  - [x] 11.4 Implement featured ad functionality
    - Implement `POST /api/listings/:id/feature` (Seller owner): check available featured slots from active package
    - Mark listing as Featured_Ad for package duration
    - Revert to standard listing when package expires (scheduled job)
    - _Requirements: 27.1, 27.2, 27.4, 27.5_

  - [x] 11.5 Implement ad limit enforcement
    - Enforce default free ad limit of 10 per seller
    - When seller reaches limit with no active packages, prevent new ad posting with message to purchase package
    - Increase available slots when ad slot package is purchased
    - Notify seller when free ad limit is reached
    - _Requirements: 26.1, 26.2, 26.3, 26.4_

  - [x] 11.6 Write unit tests for packages and payments modules
    - Test package purchase flow
    - Test payment gateway callbacks (success/failure)
    - Test featured ad activation/expiration
    - Test ad limit enforcement
    - _Requirements: 26.1–26.4, 27.1–27.5, 28.1–28.6, 29.1–29.5_

- [x] 12. Checkpoint - Ensure search, favorites, reviews, messaging, packages, and payments work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement Notifications module
  - [x] 13.1 Create Notifications module with FCM and HMS providers
    - Create `notifications.module.ts`, `notifications.service.ts`
    - Implement `fcm.provider.ts` for Firebase Cloud Messaging (Android/iOS)
    - Implement `hms.provider.ts` for Huawei Push Kit
    - Send push notifications for: new message, price drop on favorited product, product status change, new offer, successful package payment, free ad limit reached, featured ad activation, featured ad expiration reminder
    - _Requirements: 14.1, 16.4_

  - [x] 13.2 Implement notification preferences
    - Allow users to configure preferences per type: messages, offers, product updates, promotions, package alerts
    - Respect preferences when sending notifications — skip disabled types
    - _Requirements: 14.2, 14.3_

  - [x] 13.3 Wire notification triggers to favorited listing changes
    - When a favorited listing has a price or status change, notify the buyer (if product update notifications enabled)
    - _Requirements: 25.3_

  - [x] 13.4 Write unit tests for notifications module
    - Test notification dispatch for each event type
    - Test preference filtering
    - _Requirements: 14.1–14.3, 25.3_

- [x] 14. Implement Location module
  - [x] 14.1 Create Location module with Google Maps integration
    - Create `location.module.ts`, `location.service.ts`, `location.controller.ts`
    - Implement geolocation-based listing queries using MongoDB 2dsphere index (configurable radius, default 25km)
    - Prioritize geographically closer listings in recommendations
    - Handle location unavailable: prompt for manual location/postal code entry
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 14.2 Write unit tests for location module
    - Test radius-based queries
    - Test fallback to manual location
    - _Requirements: 15.1–15.4_

- [x] 15. Implement AI Recommendations and Chatbot module
  - [x] 15.1 Create User Activity schema and AI module
    - Implement `user-activity.schema.ts` with userId, action (view/search/favorite/dismiss/contact), productListingId, searchQuery, categoryId, metadata
    - Create `ai.module.ts`, `recommendation.service.ts`, `chatbot.service.ts`
    - Track user activity events from listings, search, favorites, and messaging modules
    - _Requirements: 11.1_

  - [x] 15.2 Implement recommendation endpoints
    - Implement `GET /api/recommendations` returning up to 20 personalized recommendations based on view history, search history, and liked products
    - For new users with no activity: return trending/popular listings in user's location
    - Implement `POST /api/recommendations/dismiss` to exclude similar products from future recommendations
    - Implement scheduled job (cron, every 24 hours) to update recommendation models from activity data
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 15.3 Implement AI chatbot endpoint
    - Implement `POST /api/chatbot/message` responding within 3 seconds
    - Handle FAQs for account management, product listing, platform policies
    - Maintain conversation context within a session
    - Offer escalation to human support after 3 unresolved interaction turns
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 15.4 Write unit tests for AI module
    - Test recommendation generation for active and cold-start users
    - Test dismiss functionality
    - Test chatbot response and escalation logic
    - _Requirements: 11.1–11.4, 12.1–12.4_

- [x] 16. Implement Admin module
  - [x] 16.1 Implement admin user management endpoints
    - Implement `GET /api/admin/users` (paginated, searchable, filterable by role/date/status)
    - Implement `PATCH /api/admin/users/:id/status` to suspend (invalidate all sessions, prevent login) or reactivate users
    - Implement `PATCH /api/admin/users/:id/role` to change user role and invalidate JWT tokens
    - Implement `PATCH /api/admin/users/:id/ad-limit` to override ad limit for individual sellers
    - Display user activity summaries (listings count, conversations, violations)
    - _Requirements: 6.4, 17.1, 17.2, 17.3, 17.4, 30.3_

  - [x] 16.2 Implement admin product moderation endpoints
    - Implement `GET /api/admin/listings/pending` (moderation queue, sorted oldest first)
    - Implement `PATCH /api/admin/listings/:id/approve` to set status "Active" and make visible in search
    - Implement `PATCH /api/admin/listings/:id/reject` to set status "Rejected" and notify seller with reason
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 16.3 Implement admin analytics endpoints
    - Implement `GET /api/admin/analytics` with key metrics: total users, active users (30d), total listings, total conversations, total package purchases, total revenue
    - Implement time-series data for registrations, listings, conversations, purchases over configurable date ranges
    - Implement category-level analytics (listings per category)
    - Implement `GET /api/admin/analytics/export` generating reports within 30 seconds for up to 1-year ranges
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [x] 16.4 Implement admin package and payment management endpoints
    - Implement `POST /api/packages` (create), `PATCH /api/packages/:id` (update) — Admin only
    - Allow admin to set category-specific pricing for packages
    - Implement `GET /api/admin/packages/purchases` (all purchases, filterable by date/seller/type/status)
    - Implement `GET /api/admin/payments` (all payment transactions)
    - Apply pricing changes to new purchases only; existing packages unaffected
    - Display each seller's ad count, remaining free slots, active package slots
    - _Requirements: 30.1, 30.2, 30.4, 30.5, 30.6, 26.5_

  - [x] 16.5 Write unit tests for admin module
    - Test user management (suspend/reactivate/role change)
    - Test moderation queue and approve/reject flows
    - Test analytics data aggregation
    - Test package/pricing management
    - _Requirements: 17.1–17.4, 18.1–18.4, 19.1–19.4, 30.1–30.6_

- [x] 17. Checkpoint - Ensure all backend modules are complete and integrated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Build Angular web frontend — Auth features
  - [x] 18.1 Implement auth pages (Login, Register, Forgot Password, MFA)
    - Create `features/auth/` module with Login, Register, ForgotPassword, ResetPassword, MFA verification components
    - Implement registration form with email/phone toggle and social login buttons (Google, Facebook)
    - Implement email/phone verification pages
    - Implement JWT token storage, auto-refresh via HTTP interceptor, and logout
    - Implement MFA setup page with QR code display and TOTP verification
    - _Requirements: 1.1–1.9, 2.1–2.4, 3.1–3.2, 4.1–4.2_

  - [x] 18.2 Implement user profile and settings pages
    - Create `features/profile/` module with UserProfile, Settings, NotificationPrefs components
    - Implement profile edit form (name, avatar, location)
    - Implement email/phone change with verification flow
    - Implement notification preference toggles (messages, offers, product updates, promotions, package alerts)
    - _Requirements: 5.1–5.7, 14.2, 14.3_

  - [x] 18.3 Write unit tests for auth and profile components
    - Test form validation
    - Test auth flow state management
    - _Requirements: 1.1–1.9, 2.1–2.4_

- [x] 19. Build Angular web frontend — Listings and Categories
  - [x] 19.1 Implement homepage with featured ads, recommendations, and nearby listings
    - Create `features/home/` module with HomePage component
    - Implement horizontal scrollable category chips with icons
    - Implement featured ads carousel section
    - Implement "Recommended for You" section (masonry grid)
    - Implement "Near You" section with location-based listings
    - Implement skeleton loading with shimmer effect
    - _Requirements: 11.1, 11.2, 15.2, 27.3_

  - [x] 19.2 Implement category browsing pages
    - Create `features/categories/` module with CategoryBrowse, CategoryListings components
    - Implement visual category cards on homepage with lifestyle imagery
    - Implement breadcrumb navigation with animated transitions between 3 levels
    - Display all active listings within selected category and subcategories
    - _Requirements: 9.1, 9.3_

  - [x] 19.3 Implement search results page with dynamic filters
    - Create `features/search/` module with SearchResults component
    - Implement full-screen search overlay with recent searches, trending terms, AI suggestions
    - Implement collapsible sidebar filter panel (desktop) with dynamic category-specific filters
    - Implement active filters as dismissible chips above results
    - Implement sorting options (price, newest, relevance)
    - Display Featured_Ads at top of results
    - Implement "no results" state with related categories/alternative terms
    - _Requirements: 10.1–10.7, 9.8_

  - [x] 19.4 Implement create/edit listing wizard (multi-step)
    - Create `features/listings/` module with CreateListing, EditListing, ListingDetail, MyListings components
    - Implement 5-step wizard: Category selection → Details (with dynamic category attributes) → Media upload (min 2, max 20 images + 1 video) → Location (map picker) → Review & Post (with feature ad option)
    - Implement image upload with drag-and-drop, preview, and reordering
    - Implement dynamic form fields based on selected category's attributes
    - _Requirements: 7.1–7.8, 9.2, 9.6_

  - [x] 19.5 Implement listing detail page
    - Implement full-bleed image gallery with swipe/arrow navigation
    - Display category-specific attributes, description, seller profile card (trust score, response time, verification badges)
    - Display embedded map for location
    - Display reviews section with average rating
    - Implement sticky bottom bar with price + Call/Chat CTAs
    - Implement similar listings carousel
    - Implement favorite toggle with heart burst animation
    - _Requirements: 7.2, 15.1, 20.2, 20.3_

  - [x] 19.6 Implement seller dashboard (My Listings)
    - Implement dashboard with analytics cards (views, favorites, messages)
    - Display ad slots meter (free + paid) and featured ads meter with expiration
    - Implement listing management: edit, mark sold/reserved, feature, delete
    - _Requirements: 8.1–8.4, 26.1, 27.1_

  - [x] 19.7 Write unit tests for listing and search components
    - Test multi-step wizard validation
    - Test dynamic category attribute rendering
    - Test search filter interactions
    - _Requirements: 7.1–7.8, 10.1–10.7_

- [x] 20. Build Angular web frontend — Messaging, Favorites, Reviews, Packages
  - [x] 20.1 Implement messaging interface
    - Create `features/messaging/` module with ConversationList, ChatWindow components
    - Implement WhatsApp-style chat bubbles with read receipts and typing indicators
    - Implement WebSocket connection for real-time messaging via WebSocketService
    - Implement quick-reply suggestions ("Is this still available?", "What's your best price?")
    - Embed product card at top of each conversation thread
    - _Requirements: 13.1, 13.2, 13.4_

  - [x] 20.2 Implement favorites list page
    - Create `features/favorites/` module with FavoritesList component
    - Display favorited listings with current status and price
    - Implement add/remove favorite from listing cards and detail page
    - _Requirements: 25.1, 25.2, 25.4_

  - [x] 20.3 Implement reviews pages
    - Create `features/reviews/` module with ReviewList, WriteReview components
    - Implement review submission form (1-5 stars + text, max 2000 chars)
    - Display reviews on listing detail and seller profile pages
    - _Requirements: 20.1, 20.2_

  - [x] 20.4 Implement packages and purchase flow
    - Create `features/packages/` module with PackageList, PurchaseFlow, MyPackages components
    - Display available packages with pricing (category-specific)
    - Implement purchase flow with payment method selection (JazzCash, EasyPaisa, Card)
    - Redirect to payment gateway checkout
    - Display purchase history and active packages
    - _Requirements: 28.1–28.6, 29.1–29.3_

  - [x] 20.5 Implement chatbot widget
    - Create `features/chatbot/` module with ChatbotWidget component
    - Implement floating chat widget with conversation UI
    - Maintain session context for follow-up questions
    - _Requirements: 12.1–12.4_

  - [x] 20.6 Write unit tests for messaging, favorites, reviews, and packages components
    - Test real-time message rendering
    - Test favorite toggle behavior
    - Test review form validation
    - Test package purchase flow
    - _Requirements: 13.1–13.5, 25.1–25.4, 20.1–20.5, 28.1–28.6_

- [x] 21. Build Angular web frontend — Admin panel
  - [x] 21.1 Implement admin dashboard and layout
    - Create `features/admin/` module with persistent left sidebar navigation
    - Implement `dashboard/` with AnalyticsDashboard: key metrics cards, time-series charts (Chart.js), category analytics
    - Implement report export functionality
    - _Requirements: 19.1–19.4_

  - [x] 21.2 Implement admin user management page
    - Create `admin/users/` with UserManagement component
    - Implement paginated, searchable user list with filters (role, date, status)
    - Implement suspend/reactivate, role change, ad limit override actions
    - Display user activity summaries
    - _Requirements: 17.1–17.4_

  - [x] 21.3 Implement admin moderation queue
    - Create `admin/listings/` with ModerationQueue component
    - Display pending listings sorted by submission date (oldest first)
    - Implement approve/reject actions with rejection reason input
    - _Requirements: 18.1–18.4_

  - [x] 21.4 Implement admin category manager
    - Create `admin/categories/` with CategoryManager component
    - Implement category tree CRUD with drag-and-drop reordering
    - Implement attribute and filter configuration UI per category
    - _Requirements: 9.4, 9.5, 9.7_

  - [x] 21.5 Implement admin package and payment management
    - Create `admin/packages/` with PackageManager, PricingConfig components
    - Implement package CRUD with category-specific pricing configuration
    - Create `admin/payments/` with PaymentTransactions component
    - Display all purchases and payment transactions with filters
    - _Requirements: 30.1–30.6_

  - [x] 21.6 Write unit tests for admin components
    - Test analytics dashboard data rendering
    - Test moderation queue actions
    - Test category manager CRUD
    - _Requirements: 17.1–17.4, 18.1–18.4, 19.1–19.4, 30.1–30.6_

- [x] 22. Checkpoint - Ensure Angular web frontend is complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Build Flutter mobile app — Core and Auth
  - [x] 23.1 Implement core services and auth flow
    - Set up `core/api/` with ApiClient, JWT interceptor, token storage (secure storage)
    - Set up `core/auth/` with AuthProvider for login, register, social login, MFA, password recovery
    - Set up `core/services/` with LocationService, NotificationService (FCM + HMS), WebSocketService
    - Set up `core/storage/` with Hive/SQLite for offline caching
    - Implement auth screens: Login, Register (email/phone/social), Verification, MFA, ForgotPassword
    - _Requirements: 1.1–1.9, 2.1–2.4, 3.1–3.2, 4.1–4.2, 16.1, 16.4_

  - [x] 23.2 Implement profile and settings screens
    - Implement profile edit screen with avatar upload
    - Implement email/phone change with verification
    - Implement notification preference toggles
    - _Requirements: 5.1–5.7, 14.2, 14.3_

  - [x] 23.3 Write widget tests for auth and profile screens
    - Test form validation and auth state transitions
    - _Requirements: 1.1–1.9, 2.1–2.4_

- [x] 24. Build Flutter mobile app — Listings, Search, and Categories
  - [x] 24.1 Implement home screen
    - Implement horizontal scrollable category chips with icons
    - Implement featured ads horizontal scroll section
    - Implement "For You" recommendations grid
    - Implement pull-to-refresh with custom branded animation
    - Implement skeleton loading with shimmer effect
    - _Requirements: 11.1, 11.2, 27.3_

  - [x] 24.2 Implement category browsing and search screens
    - Implement category browse with 3-level navigation
    - Implement full-screen search with recent searches, trending terms, AI suggestions
    - Implement bottom sheet filter panel with dynamic category-specific filters
    - Implement active filters as dismissible chips
    - Implement sorting options
    - _Requirements: 9.1, 9.3, 9.8, 10.1–10.7_

  - [x] 24.3 Implement create/edit listing screens (multi-step wizard)
    - Implement 5-step wizard matching web: Category → Details (dynamic attributes) → Media (camera/gallery, min 2, max 20 images + 1 video) → Location (map picker) → Review & Post
    - Implement step indicator with animated progress bar
    - Support offline draft saving via Hive/SQLite
    - _Requirements: 7.1–7.8, 9.2, 9.6, 16.3_

  - [x] 24.4 Implement listing detail screen
    - Implement full-bleed image gallery with swipe gestures and pinch-to-zoom
    - Display category-specific attributes, seller card with trust score
    - Display embedded map, reviews section
    - Implement sticky bottom bar with price + Call/Chat CTAs
    - Implement favorite toggle with heart burst particle animation
    - Implement shared element transition from listing card
    - _Requirements: 7.2, 15.1, 20.2, 20.3_

  - [x] 24.5 Implement seller dashboard screen
    - Implement analytics cards (views, favorites, messages)
    - Display ad slots and featured ads meters
    - Implement listing management actions
    - _Requirements: 8.1–8.4, 26.1, 27.1_

  - [x] 24.6 Write widget tests for listing and search screens
    - Test wizard step navigation
    - Test dynamic attribute rendering
    - Test search filter interactions
    - _Requirements: 7.1–7.8, 10.1–10.7_

- [x] 25. Build Flutter mobile app — Messaging, Favorites, Reviews, Packages, Chatbot
  - [x] 25.1 Implement messaging screens
    - Implement ConversationList and ChatWindow screens
    - Implement WhatsApp-style chat bubbles with read receipts and typing indicators
    - Implement WebSocket real-time messaging
    - Implement quick-reply suggestions
    - Embed product card at top of conversation
    - Implement chat message slide-up entrance animation
    - _Requirements: 13.1, 13.2, 13.4_

  - [x] 25.2 Implement favorites, reviews, packages, and chatbot screens
    - Implement favorites list screen with current status/price
    - Implement review submission and display screens
    - Implement package list, purchase flow (JazzCash, EasyPaisa, Card), and my packages screens
    - Implement chatbot floating widget with conversation UI
    - _Requirements: 25.1–25.4, 20.1–20.5, 28.1–28.6, 12.1–12.4_

  - [x] 25.3 Implement offline support and sync
    - Cache previously loaded listings in Hive/SQLite for offline browsing
    - Save draft listings offline
    - Implement sync service to reconcile local changes when connectivity is restored
    - _Requirements: 16.3_

  - [x] 25.4 Write widget tests for messaging, favorites, and packages screens
    - Test real-time message rendering
    - Test offline cache behavior
    - Test package purchase flow
    - _Requirements: 13.1–13.5, 25.1–25.4, 28.1–28.6_

- [x] 26. Checkpoint - Ensure Flutter mobile app is complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 27. Implement responsive design, dark mode, and micro-interactions
  - [x] 27.1 Implement responsive breakpoints and dark mode (Angular)
    - Implement responsive layouts for all breakpoints: Mobile S (320px), Mobile L (425px), Tablet (768px), Laptop (1024px), Desktop (1440px), Wide (1920px+)
    - Implement dark mode with automatic system preference detection and manual toggle
    - Dark palette: Background (#1A1A2E), Surface (#16213E), Card (#0F3460), Text (#E8E8E8)
    - Ensure WCAG AA contrast ratios in both modes
    - _Requirements: 16.2_

  - [x] 27.2 Implement micro-interactions and animations (Angular + Flutter)
    - Implement shared element transitions between listing cards and detail pages
    - Implement favorite heart burst particle animation
    - Implement pull-to-refresh custom branded animation (Flutter)
    - Implement skeleton shimmer loading placeholders
    - Implement filter chip slide-in/out with spring physics
    - Implement bottom navigation active tab scale animation (Flutter)
    - Implement toast notifications with slide-down and swipe-to-dismiss
    - _Requirements: 16.2_

  - [x] 27.3 Write visual regression tests for responsive layouts
    - Test key pages at each breakpoint
    - Test dark mode rendering
    - _Requirements: 16.2_

- [x] 28. Set up CI/CD pipeline and deployment
  - [x] 28.1 Create Dockerfiles and docker-compose for backend services
    - Create Dockerfile for NestJS backend
    - Create docker-compose.yml with MongoDB, Redis, Elasticsearch, and backend services
    - Configure separate environment configs for staging and production
    - _Requirements: 23.3, 23.4_

  - [x] 28.2 Set up CI/CD pipeline (GitHub Actions)
    - Configure pipeline to run linting, unit tests, and integration tests on every pull request to main
    - On merge to main: auto-deploy to staging environment
    - Configure manual promotion from staging to production (blue-green or rolling deployment)
    - _Requirements: 23.1, 23.2_

  - [x] 28.3 Set up mobile CI/CD with Fastlane
    - Configure Fastlane for iOS build and signing → Apple App Store
    - Configure Fastlane for Android build and signing → Google Play Store
    - Configure Fastlane for Huawei build and signing → Huawei AppGallery
    - Integrate mobile builds into CI/CD pipeline
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

  - [x] 28.4 Write integration tests for CI/CD pipeline
    - Test Docker build process
    - Test deployment scripts
    - _Requirements: 23.1–23.4_

- [x] 29. Final checkpoint - Full system integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Backend modules (tasks 3–16) should be completed before frontend work (tasks 18–25)
- The tech stack is: NestJS/TypeScript (backend), Angular/TypeScript (web), Flutter/Dart (mobile), MongoDB, Redis, Elasticsearch
- Payment gateway integrations (JazzCash, EasyPaisa, Card) require sandbox/test credentials for development
