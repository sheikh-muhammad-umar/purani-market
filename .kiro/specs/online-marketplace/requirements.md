# Requirements Document

## Introduction

This document defines the requirements for a comprehensive online marketplace application similar to OLX. The platform enables buyers and sellers to list, discover, and communicate about products across web (Angular) and mobile (Flutter) clients. The backend is powered by Node.js/NestJS with MongoDB, and AI-powered personalization enhances the user experience. The system supports iOS, Android, and Huawei platforms with real-time communication, location-based features, and a full admin panel.

## Glossary

- **Marketplace_System**: The overall online marketplace application encompassing web, mobile, and backend services.
- **Auth_Service**: The authentication and authorization service responsible for user identity management, login, registration, and access control.
- **User**: Any registered individual on the platform (may act as Buyer, Seller, or Admin).
- **Buyer**: A registered user who browses, searches, and discovers products.
- **Seller**: A registered user who creates and manages product listings.
- **Admin**: A privileged user who manages the platform, users, products, packages, pricing, and analytics.
- **Product_Listing_Service**: The service responsible for creating, updating, deleting, and managing product listings.
- **Product_Listing**: A product entry (ad) created by a Seller containing title, description, price, category, condition, images/video, location, and category-specific attributes.
- **Ad_Limit**: The maximum number of free ads a Seller can post (default 10). Additional ad slots require purchasing a package.
- **Featured_Ad**: A Product_Listing that has been promoted by the Seller via a paid package to appear at the top of search results within its category.
- **Ad_Package**: A purchasable bundle that grants a Seller featured ad slots and/or additional ad posting slots for a specific duration (7, 15, or 30 days), with pricing configurable per category/subcategory.
- **Package_Service**: The service responsible for managing ad packages, featured ad promotions, ad posting limits, and package purchases.
- **Payment_Gateway_Service**: The service responsible for processing payments for ad packages via JazzCash, EasyPaisa, and Credit/Debit Cards.
- **Category_Attribute**: A dynamic, category-specific field (e.g., Make, Model, Mileage for Cars; Brand, Storage for Mobile Phones) that is configured by the Admin and presented to Sellers during ad creation.
- **Category_Filter**: A dynamic, category-specific search filter (e.g., Make, Mileage Range for Cars; Brand, Storage for Mobile Phones) configured by the Admin and available to Buyers on search/listing pages.
- **Search_Service**: The service responsible for product search, filtering, sorting, and auto-suggestions.
- **AI_Recommendation_Engine**: The AI-powered service that provides personalized product recommendations and behavior analysis.
- **AI_Chatbot**: The AI-powered conversational agent for FAQs, product inquiries, and buyer-seller communication assistance.
- **Messaging_Service**: The real-time in-app messaging service for buyer-seller communication.
- **Notification_Service**: The service responsible for push notifications and real-time alerts.
- **Location_Service**: The service responsible for geolocation features, map integration, and proximity-based recommendations.
- **Review_Service**: The service responsible for product and seller ratings and reviews.
- **Admin_Dashboard**: The administrative interface for managing users, products, categories, packages, pricing, analytics, and platform moderation.
- **MFA**: Multi-Factor Authentication, an additional security layer requiring two or more verification methods.
- **JWT**: JSON Web Token, used for secure stateless authentication.
- **CI_CD_Pipeline**: Continuous Integration and Continuous Deployment pipeline for automated build, test, and deployment.

## Requirements

### Requirement 1: User Registration

**User Story:** As a visitor, I want to register an account using email, phone number, or social login, so that I can access the marketplace as a Buyer or Seller.

#### Acceptance Criteria

1. WHEN a visitor submits a registration form with a valid email and password, THE Auth_Service SHALL create a new User account with email marked as "unverified" and send a verification email containing a unique verification link (valid for 24 hours) within 5 seconds.
2. WHEN a visitor submits a registration form with a valid phone number, THE Auth_Service SHALL create a new User account with phone marked as "unverified" and send an SMS verification code (6-digit OTP, valid for 10 minutes) within 10 seconds.
3. WHEN a visitor clicks the email verification link, THE Auth_Service SHALL mark the email as "verified" and grant full account access.
4. WHEN a visitor submits a valid SMS OTP code, THE Auth_Service SHALL mark the phone number as "verified" and grant full account access.
5. IF a visitor does not verify their email or phone within 24 hours of registration, THEN THE Auth_Service SHALL send a reminder notification. The account SHALL remain in "unverified" status with restricted access (cannot post ads or send messages) until verification is completed.
6. IF a visitor requests a new verification email or SMS OTP, THE Auth_Service SHALL invalidate any previously issued verification token/code and send a new one. THE Auth_Service SHALL allow a maximum of 5 resend requests per hour.
7. WHEN a visitor initiates registration via Google or Facebook social login, THE Auth_Service SHALL authenticate the visitor using the respective OAuth 2.0 provider, create a new User account, and mark the email as "verified" (since the OAuth provider has already verified it).
8. IF a visitor submits a registration form with an email or phone number already associated with an existing account, THEN THE Auth_Service SHALL return an error message indicating the email or phone number is already registered.
9. IF a visitor submits a registration form with invalid or incomplete data, THEN THE Auth_Service SHALL return a descriptive validation error specifying the invalid fields.

### Requirement 2: User Login

**User Story:** As a registered User, I want to log in using my credentials or social login, so that I can access my account and marketplace features.

#### Acceptance Criteria

1. WHEN a User submits valid email/phone and password credentials, THE Auth_Service SHALL authenticate the User and return a JWT access token and a refresh token.
2. WHEN a User initiates login via Google or Facebook, THE Auth_Service SHALL authenticate the User using the respective OAuth 2.0 provider and return a JWT access token.
3. IF a User submits invalid credentials, THEN THE Auth_Service SHALL return an authentication error without revealing whether the email or password was incorrect.
4. WHEN a User successfully authenticates, THE Auth_Service SHALL record the login timestamp and device information.

### Requirement 3: Multi-Factor Authentication

**User Story:** As a registered User, I want to enable multi-factor authentication, so that my account has an additional layer of security.

#### Acceptance Criteria

1. WHEN a User enables MFA in account settings, THE Auth_Service SHALL generate and store a TOTP secret and present a QR code for authenticator app setup.
2. WHILE MFA is enabled for a User account, WHEN the User submits valid primary credentials, THE Auth_Service SHALL prompt for a second-factor verification code before granting access.
3. IF a User submits an invalid MFA verification code, THEN THE Auth_Service SHALL deny access and increment the failed attempt counter.
4. IF the failed MFA attempt counter reaches 5 within a 15-minute window, THEN THE Auth_Service SHALL temporarily lock the account for 30 minutes.

### Requirement 4: Password Recovery

**User Story:** As a registered User, I want to recover my password if I forget it, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a User requests a password reset with a registered email, THE Auth_Service SHALL send a password reset link valid for 30 minutes.
2. WHEN a User submits a new password via a valid reset link, THE Auth_Service SHALL update the password and invalidate all existing sessions.
3. IF a User submits a password reset request with an unregistered email, THEN THE Auth_Service SHALL return a generic success message without revealing whether the email exists.

### Requirement 5: Email and Phone Change Verification

**User Story:** As a registered User, I want to change my email or phone number with proper verification, so that my account contact information stays accurate and secure.

#### Acceptance Criteria

1. WHEN a User requests to change their email address, THE Auth_Service SHALL send a verification link (valid for 24 hours) to the new email address. The current email SHALL remain active until the new email is verified.
2. WHEN a User clicks the new email verification link, THE Auth_Service SHALL update the account email to the new address, mark it as "verified", invalidate all existing sessions, and send a confirmation notification to the old email address.
3. WHEN a User requests to change their phone number, THE Auth_Service SHALL send a 6-digit SMS OTP (valid for 10 minutes) to the new phone number. The current phone number SHALL remain active until the new phone is verified.
4. WHEN a User submits a valid OTP for the new phone number, THE Auth_Service SHALL update the account phone number to the new number, mark it as "verified", and invalidate all existing sessions.
5. IF a User requests to change their email or phone to one already associated with another account, THEN THE Auth_Service SHALL return an error indicating the email or phone is already in use.
6. IF the verification link or OTP for a change request expires without being used, THEN THE Auth_Service SHALL discard the change request and the existing email or phone SHALL remain unchanged.
7. THE Auth_Service SHALL allow a maximum of 3 email or phone change requests per 24-hour period per User.

### Requirement 6: Role-Based Access Control

**User Story:** As an Admin, I want to assign roles to users, so that access to platform features is controlled based on user roles.

#### Acceptance Criteria

1. THE Auth_Service SHALL enforce role-based access control for three roles: Admin, Seller, and Buyer.
2. WHEN a User with the Buyer role attempts to access Seller-only or Admin-only endpoints, THE Auth_Service SHALL return a 403 Forbidden response.
3. WHEN a User with the Seller role attempts to access Admin-only endpoints, THE Auth_Service SHALL return a 403 Forbidden response.
4. WHEN an Admin assigns or changes a User role, THE Auth_Service SHALL update the role and invalidate the User's current JWT tokens.


### Requirement 7: Create Product Listing (Ad Posting)

**User Story:** As a Seller, I want to create a product listing (ad) with details like title, description, price, images, video, and location, so that Buyers can discover my products.

#### Acceptance Criteria

1. WHEN a Seller submits a valid product listing form, THE Product_Listing_Service SHALL create a new Product_Listing with status "Active" (or "Pending Review" if moderation is enabled) and return a confirmation with the listing ID.
2. THE Product_Listing_Service SHALL require the following general attributes for each Product_Listing: title (max 150 characters), description (max 5000 characters), price (positive numeric value with currency), category (up to 3 levels), condition (New, Used, Refurbished), at least 2 media items (pictures or video), location, and contact information (phone number, email).
3. THE Product_Listing_Service SHALL enforce media upload limits: a maximum of 20 pictures (JPEG, PNG, WebP, each under 5MB) and a maximum of 1 video (MP4, max 50MB) per ad.
4. IF a Seller attempts to upload more than 20 pictures or more than 1 video, THEN THE Product_Listing_Service SHALL return an error message indicating the media upload limit has been exceeded.
5. IF a Seller submits a product listing with fewer than 2 media items, THEN THE Product_Listing_Service SHALL return a validation error requiring at least 2 media items.
6. IF a Seller submits a product listing with missing or invalid required fields, THEN THE Product_Listing_Service SHALL return a descriptive validation error specifying the invalid fields.
7. WHEN a Seller uploads images for a Product_Listing, THE Product_Listing_Service SHALL validate image format and compress images to optimize storage and loading performance.
8. WHEN a Seller selects a category, THE Product_Listing_Service SHALL dynamically present the category-specific attributes (Category_Attributes) configured for that category, and the Seller SHALL fill in the relevant fields.

### Requirement 8: Manage Product Listing

**User Story:** As a Seller, I want to edit, update status, and delete my product listings, so that I can keep my listings accurate and current.

#### Acceptance Criteria

1. WHEN a Seller submits an update to an existing Product_Listing, THE Product_Listing_Service SHALL update the specified fields and record the modification timestamp.
2. WHEN a Seller marks a Product_Listing as "Sold" or "Reserved", THE Product_Listing_Service SHALL update the listing status and reflect the change in search results within 30 seconds.
3. WHEN a Seller deletes a Product_Listing, THE Product_Listing_Service SHALL soft-delete the listing, removing it from search results while retaining the data for 90 days.
4. IF a User other than the owning Seller or an Admin attempts to modify a Product_Listing, THEN THE Product_Listing_Service SHALL return a 403 Forbidden response.

### Requirement 9: Product Categories and Dynamic Attributes

**User Story:** As a Buyer, I want to browse products organized by categories and subcategories with category-specific details and filters, so that I can find relevant products efficiently.

#### Acceptance Criteria

1. THE Product_Listing_Service SHALL support a hierarchical category structure with up to 3 levels of nesting (category, subcategory, sub-subcategory). Example: Electronics → Mobile Phones → Smartphones; Vehicles → Cars → Sedans; Fashion → Clothing → Women's Apparel.
2. WHEN a Seller creates a Product_Listing, THE Product_Listing_Service SHALL require the Seller to select at least one category from the predefined category hierarchy.
3. WHEN a Buyer requests a category listing, THE Product_Listing_Service SHALL return all active Product_Listings within the selected category and its subcategories.
4. THE Admin_Dashboard SHALL allow an Admin to add, edit, and remove categories, subcategories, and sub-subcategories. Category names SHALL be configurable by the Admin.
5. THE Admin_Dashboard SHALL allow an Admin to define and manage Category_Attributes for each category (e.g., Make, Model, Mileage, Body Type for Cars; Brand, Storage, Color for Mobile Phones; Bedrooms, Bathrooms, Area for Real Estate).
6. WHEN a Seller selects a category during ad creation, THE Product_Listing_Service SHALL dynamically display only the Category_Attributes relevant to the selected category.
7. THE Admin_Dashboard SHALL allow an Admin to define and manage Category_Filters for each category (e.g., Make, Model, Condition, Mileage Range for Cars; Brand, Storage, Condition for Mobile Phones; Bedrooms, Area, Furnishing for Real Estate).
8. WHEN a Buyer browses or searches within a category, THE Search_Service SHALL display only the Category_Filters relevant to the selected category, enabling Buyers to refine results using category-specific criteria.

### Requirement 10: Product Search and Category-Specific Filters

**User Story:** As a Buyer, I want to search for products using keywords and category-specific filters, so that I can quickly find products that match my needs.

#### Acceptance Criteria

1. WHEN a Buyer submits a search query, THE Search_Service SHALL return matching Product_Listings ranked by relevance within 2 seconds, with Featured_Ads displayed at the top of results within their respective category.
2. THE Search_Service SHALL support filtering by: price range, category, location (radius from a point), date posted, and product condition.
3. THE Search_Service SHALL support sorting by: price low to high, price high to low, newest first, and relevance.
4. WHEN a Buyer types in the search bar, THE Search_Service SHALL provide auto-suggestions based on popular searches and matching product titles within 500 milliseconds.
5. WHEN a search query returns no results, THE Search_Service SHALL display a "no results found" message and suggest related categories or alternative search terms.
6. WHEN a Buyer selects a specific category, THE Search_Service SHALL dynamically display the Category_Filters configured for that category (e.g., Make, Model, Mileage for Cars; Brand, Storage for Mobile Phones; Bedrooms, Area for Real Estate).
7. THE Search_Service SHALL query the database using the selected Category_Filters and return only Product_Listings matching all applied filter criteria.

### Requirement 11: AI-Powered Product Recommendations

**User Story:** As a Buyer, I want to receive personalized product recommendations based on my browsing and search activity, so that I can discover relevant products more easily.

#### Acceptance Criteria

1. WHEN a Buyer views the home page or a product detail page, THE AI_Recommendation_Engine SHALL display up to 20 personalized product recommendations based on the Buyer's view history, search history, and liked products.
2. WHEN a new Buyer with no activity history views the home page, THE AI_Recommendation_Engine SHALL display trending and popular Product_Listings in the Buyer's selected location.
3. THE AI_Recommendation_Engine SHALL update recommendation models based on User activity data at least once every 24 hours.
4. WHEN a Buyer dismisses a recommendation, THE AI_Recommendation_Engine SHALL exclude similar products from future recommendations for that Buyer.

### Requirement 12: AI Chatbot

**User Story:** As a User, I want to interact with an AI chatbot for FAQs and product inquiries, so that I can get quick answers without waiting for human support.

#### Acceptance Criteria

1. WHEN a User initiates a chatbot conversation, THE AI_Chatbot SHALL respond to the User's query within 3 seconds.
2. THE AI_Chatbot SHALL handle FAQs related to account management, product listing, and platform policies.
3. IF the AI_Chatbot cannot resolve a User query after 3 interaction turns, THEN THE AI_Chatbot SHALL offer to escalate the conversation to a human support agent.
4. THE AI_Chatbot SHALL maintain conversation context within a single session so that follow-up questions reference prior messages.


### Requirement 13: Buyer-Seller Messaging

**User Story:** As a Buyer, I want to send messages to Sellers about their products, so that I can ask questions and negotiate before purchasing.

#### Acceptance Criteria

1. WHEN a Buyer sends a message to a Seller from a Product_Listing page, THE Messaging_Service SHALL deliver the message in real-time using WebSocket connections.
2. THE Messaging_Service SHALL organize conversations by Product_Listing, so that each product inquiry has a separate conversation thread.
3. WHEN a User receives a new message while offline, THE Notification_Service SHALL send a push notification to the User's registered devices within 10 seconds of the message being sent.
4. THE Messaging_Service SHALL store all messages persistently and allow Users to retrieve conversation history with pagination (20 messages per page).
5. IF a User sends a message containing prohibited content (as defined by platform content policy), THEN THE Messaging_Service SHALL block the message and notify the sender.

### Requirement 14: Push Notifications

**User Story:** As a User, I want to receive push notifications for important events, so that I stay informed about messages, offers, and product updates.

#### Acceptance Criteria

1. WHEN a relevant event occurs (new message, price drop on a favorited product, product status change, new offer, successful package payment, free ad limit reached, featured ad package activation, or featured ad package expiration reminder), THE Notification_Service SHALL send a push notification to the affected User's registered devices.
2. THE Notification_Service SHALL allow Users to configure notification preferences for each notification type (messages, offers, product updates, promotions, package alerts).
3. WHEN a User disables a specific notification type, THE Notification_Service SHALL stop sending push notifications of that type to the User.

### Requirement 15: Location-Based Product Display

**User Story:** As a Buyer, I want to see products on a map and find products near my location, so that I can discover nearby deals conveniently.

#### Acceptance Criteria

1. WHEN a Buyer views a Product_Listing detail page, THE Location_Service SHALL display the product location on an embedded map (using Google Maps API or equivalent).
2. WHEN a Buyer enables location-based browsing, THE Location_Service SHALL retrieve the Buyer's current geolocation (with explicit consent) and display Product_Listings within a configurable radius (default 25 km).
3. THE Location_Service SHALL provide location-based product recommendations by prioritizing Product_Listings geographically closer to the Buyer.
4. IF the Location_Service cannot determine the Buyer's location, THEN THE Location_Service SHALL prompt the Buyer to manually enter a location or postal code.

### Requirement 16: Mobile Application

**User Story:** As a User, I want to use the marketplace on my mobile device (iOS, Android, Huawei), so that I can buy and sell products on the go.

#### Acceptance Criteria

1. THE Marketplace_System SHALL provide a mobile application built with Flutter that runs on iOS, Android, and Huawei devices.
2. THE mobile application SHALL implement a responsive, mobile-first design that adapts to screen sizes from 4 inches to 12.9 inches.
3. THE mobile application SHALL support offline capabilities, allowing Users to browse previously loaded Product_Listings and draft new listings while offline, syncing changes when connectivity is restored.
4. THE mobile application SHALL integrate with Firebase Cloud Messaging for push notification delivery on Android and iOS, and Huawei Push Kit for Huawei devices.

### Requirement 17: Admin User Management

**User Story:** As an Admin, I want to manage user accounts, so that I can maintain platform integrity and handle user issues.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a paginated, searchable list of all registered Users with filters for role, registration date, and account status.
2. WHEN an Admin suspends a User account, THE Auth_Service SHALL immediately invalidate all active sessions for that User and prevent new logins.
3. WHEN an Admin reactivates a suspended User account, THE Auth_Service SHALL restore login access for that User.
4. THE Admin_Dashboard SHALL display User activity summaries including number of listings, conversations, and reported violations.

### Requirement 18: Admin Product Moderation

**User Story:** As an Admin, I want to approve or reject product listings, so that only appropriate content is visible on the platform.

#### Acceptance Criteria

1. WHERE product moderation is enabled, WHEN a Seller creates a new Product_Listing, THE Product_Listing_Service SHALL set the listing status to "Pending Review" and queue it for Admin approval.
2. WHEN an Admin approves a Product_Listing, THE Product_Listing_Service SHALL set the listing status to "Active" and make it visible in search results.
3. WHEN an Admin rejects a Product_Listing, THE Product_Listing_Service SHALL set the listing status to "Rejected" and notify the Seller with the rejection reason.
4. THE Admin_Dashboard SHALL display a queue of Product_Listings with "Pending Review" status, sorted by submission date (oldest first).


### Requirement 19: Admin Analytics Dashboard

**User Story:** As an Admin, I want to view platform analytics, so that I can make data-driven decisions about the marketplace.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display key metrics: total registered Users, active Users (last 30 days), total Product_Listings, total conversations, total package purchases, and total revenue from packages.
2. THE Admin_Dashboard SHALL display time-series charts for user registrations, product listings created, conversations initiated, and package purchases over configurable date ranges.
3. THE Admin_Dashboard SHALL display category-level analytics showing the number of listings per product category.
4. WHEN an Admin requests an analytics report, THE Admin_Dashboard SHALL generate the report within 30 seconds for date ranges up to 1 year.

### Requirement 20: Product Reviews and Ratings

**User Story:** As a Buyer, I want to rate and review Sellers and products after interacting with them, so that other Buyers can make informed decisions.

#### Acceptance Criteria

1. WHEN a Buyer has had a conversation with a Seller about a Product_Listing, THE Review_Service SHALL allow the Buyer to submit a rating (1 to 5 stars) and a text review (max 2000 characters) for the Product_Listing and the Seller.
2. THE Review_Service SHALL display all approved reviews on the Product_Listing detail page and the Seller profile page, sorted by most recent first.
3. THE Review_Service SHALL calculate and display an average rating for each Seller based on all received reviews.
4. IF a Buyer attempts to submit a review for a product the Buyer has not interacted with, THEN THE Review_Service SHALL reject the review submission with an appropriate error message.
5. WHEN a review contains prohibited content, THE Review_Service SHALL flag the review for Admin moderation and withhold it from public display until approved.

### Requirement 21: Data Security

**User Story:** As a User, I want my data to be stored and transmitted securely, so that my personal information is protected.

#### Acceptance Criteria

1. THE Marketplace_System SHALL encrypt all data in transit using TLS 1.2 or higher.
2. THE Auth_Service SHALL hash all user passwords using bcrypt with a minimum cost factor of 12 before storage.
3. THE Marketplace_System SHALL implement input validation and parameterized queries on all API endpoints to prevent injection attacks (NoSQL injection, XSS, CSRF).
4. THE Auth_Service SHALL implement rate limiting on authentication endpoints, allowing a maximum of 10 login attempts per IP address within a 15-minute window.
5. IF the rate limit is exceeded on an authentication endpoint, THEN THE Auth_Service SHALL return a 429 Too Many Requests response with a Retry-After header.

### Requirement 22: API Security

**User Story:** As a developer, I want all API endpoints to be secured with proper authentication and authorization, so that unauthorized access is prevented.

#### Acceptance Criteria

1. THE Marketplace_System SHALL require a valid JWT access token for all API endpoints except registration, login, password recovery, and public product search.
2. WHEN a JWT access token expires, THE Auth_Service SHALL allow the client to obtain a new access token using a valid refresh token without requiring re-authentication.
3. THE Marketplace_System SHALL validate the origin of all requests using CORS policies, allowing only registered client domains.
4. THE Marketplace_System SHALL implement CSRF protection on all state-changing API endpoints.

### Requirement 23: Deployment and CI/CD

**User Story:** As a DevOps engineer, I want automated build, test, and deployment pipelines, so that releases are consistent and reliable.

#### Acceptance Criteria

1. THE CI_CD_Pipeline SHALL automatically run unit tests, integration tests, and linting on every pull request to the main branch.
2. WHEN all CI checks pass on a pull request merge to the main branch, THE CI_CD_Pipeline SHALL automatically deploy the application to the staging environment.
3. THE Marketplace_System SHALL be deployable to cloud platforms (AWS, Google Cloud, or Azure) using containerized deployments (Docker).
4. THE CI_CD_Pipeline SHALL support separate deployment configurations for staging and production environments.

### Requirement 24: Mobile App Store Distribution

**User Story:** As a product owner, I want the mobile app published on all major app stores, so that Users can download and install the app on their devices.

#### Acceptance Criteria

1. THE mobile application SHALL meet Apple App Store review guidelines and be published on the Apple App Store.
2. THE mobile application SHALL meet Google Play Store policies and be published on the Google Play Store.
3. THE mobile application SHALL meet Huawei AppGallery review requirements and be published on the Huawei AppGallery.
4. THE CI_CD_Pipeline SHALL support automated build and signing for iOS, Android, and Huawei app packages.

### Requirement 25: Favorites and Wishlist

**User Story:** As a Buyer, I want to save products to a favorites list, so that I can easily find and track products I am interested in.

#### Acceptance Criteria

1. WHEN a Buyer adds a Product_Listing to favorites, THE Product_Listing_Service SHALL store the association and confirm the action to the Buyer.
2. WHEN a Buyer views the favorites list, THE Product_Listing_Service SHALL return all favorited Product_Listings with current status and price information.
3. WHEN a favorited Product_Listing has a price change or status change, THE Notification_Service SHALL notify the Buyer if the Buyer has enabled product update notifications.
4. WHEN a Buyer removes a Product_Listing from favorites, THE Product_Listing_Service SHALL remove the association immediately.

### Requirement 26: Ad Posting Limits

**User Story:** As a platform operator, I want to limit the number of free ads a Seller can post, so that the platform can monetize through ad packages while still allowing basic free usage.

#### Acceptance Criteria

1. THE Package_Service SHALL enforce a default free Ad_Limit of 10 ads per Seller. The Ad_Limit SHALL be configurable by the Admin via the Admin_Dashboard.
2. WHEN a Seller has reached the free Ad_Limit and has no active ad slot packages, THE Product_Listing_Service SHALL prevent the Seller from posting new ads and display a message directing them to purchase an ad package.
3. WHEN a Seller purchases an ad slot package, THE Package_Service SHALL increase the Seller's available ad slots by the quantity specified in the purchased package for the package duration.
4. THE Notification_Service SHALL notify the Seller when they reach the free Ad_Limit.
5. THE Admin_Dashboard SHALL allow an Admin to view each Seller's current ad count, remaining free slots, and active package slots.

### Requirement 27: Featured Ads

**User Story:** As a Seller, I want to feature my ads so they appear at the top of search results in their category, so that my products get more visibility.

#### Acceptance Criteria

1. WHEN a Seller opts to feature a Product_Listing, THE Package_Service SHALL check that the Seller has available featured ad slots from an active Ad_Package.
2. WHEN a Seller has available featured ad slots, THE Package_Service SHALL mark the Product_Listing as a Featured_Ad for the remaining duration of the active package.
3. THE Search_Service SHALL display Featured_Ads at the top of search results and category listing pages, above non-featured listings, within their respective category.
4. WHEN a Featured_Ad's package duration expires, THE Package_Service SHALL revert the Product_Listing to a standard (non-featured) listing.
5. THE Package_Service SHALL support feature durations of 7, 15, and 30 days with pricing that varies by category and subcategory.

### Requirement 28: Ad Package Purchase

**User Story:** As a Seller, I want to purchase ad packages for featured ads and additional ad slots, so that I can promote my products and post more ads.

#### Acceptance Criteria

1. THE Package_Service SHALL offer the following package options for each supported duration (7, 15, 30 days): featured ad bundles (e.g., 5 or 10 featured ads) and additional ad slot bundles (e.g., 10 or 20 additional slots), with pricing configurable per category/subcategory by the Admin.
2. THE Package_Service SHALL support default pricing tiers: 7 days (Rs 500 for 5 featured ads, Rs 1000 for 10 ad slots, Rs 900 for 10 featured ads, Rs 1800 for 20 ad slots), 15 days (Rs 1000 for 5 featured ads, Rs 2000 for 10 ad slots, Rs 1800 for 10 featured ads, Rs 3600 for 20 ad slots), 30 days (Rs 1800 for 5 featured ads, Rs 3800 for 10 ad slots, Rs 3400 for 10 featured ads, Rs 7000 for 20 ad slots).
3. THE Package_Service SHALL allow a Seller to purchase multiple packages simultaneously (e.g., both featured ads and additional slots in a single transaction).
4. WHEN a Seller selects a package, THE Package_Service SHALL redirect the Seller to the Payment_Gateway_Service to complete the transaction.
5. WHEN the Payment_Gateway_Service confirms a successful payment, THE Package_Service SHALL activate the purchased package, update the Seller's available featured ad slots and/or ad posting slots, and notify the Seller.
6. IF a payment fails or is declined, THEN THE Package_Service SHALL not activate the package and notify the Seller with the failure reason.

### Requirement 29: Package Payment Processing

**User Story:** As a Seller, I want to pay for ad packages using JazzCash, EasyPaisa, or Credit/Debit Cards, so that I can conveniently purchase packages using my preferred payment method.

#### Acceptance Criteria

1. THE Payment_Gateway_Service SHALL integrate with JazzCash, EasyPaisa, and Credit/Debit Card payment gateways for processing package payments.
2. WHEN a Seller initiates a package payment, THE Payment_Gateway_Service SHALL create a secure payment session and redirect the Seller to the selected gateway's checkout page.
3. WHEN a payment gateway confirms a successful payment, THE Payment_Gateway_Service SHALL record the transaction details (amount, currency, payment method, timestamp, Seller ID, package ID) and return a real-time payment confirmation to the Seller.
4. IF a payment fails or is declined by the gateway, THEN THE Payment_Gateway_Service SHALL record the failed transaction and notify the Seller with the failure reason.
5. THE Payment_Gateway_Service SHALL encrypt all payment data in transit and SHALL NOT store sensitive payment credentials (card numbers, PINs).

### Requirement 30: Admin Package and Pricing Management

**User Story:** As an Admin, I want to manage ad packages, pricing, and Seller ad limits, so that I can control the platform's monetization and ad policies.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL allow an Admin to create, edit, and deactivate Ad_Packages, specifying: package name, duration (7, 15, 30 days), number of featured ad slots, number of additional ad slots, and price.
2. THE Admin_Dashboard SHALL allow an Admin to set different package prices for each category and subcategory.
3. THE Admin_Dashboard SHALL allow an Admin to update the default free Ad_Limit for new Sellers and override the Ad_Limit for individual Sellers.
4. THE Admin_Dashboard SHALL display a paginated list of all package purchases with filters for date range, Seller, package type, and payment status.
5. THE Admin_Dashboard SHALL allow an Admin to view, approve, or remove ads, and monitor package payment transactions.
6. WHEN an Admin updates package pricing or ad limits, THE Package_Service SHALL apply the changes to new purchases immediately; existing active packages SHALL remain unaffected until expiration.
