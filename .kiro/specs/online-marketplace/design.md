# Design Document

## Overview

This document describes the high-level architecture and technical design for the Online Marketplace platform — an OLX-like application with web (Angular), mobile (Flutter), and backend (NestJS + MongoDB) components. The system supports user authentication, product listing with category-specific attributes, search with dynamic filters, AI-powered recommendations, real-time messaging, ad packages with payment processing, location-based features, and a comprehensive admin panel.

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Angular Web  │  │ Flutter iOS  │  │Flutter Android│  │Flutter HMS │ │
│  │    (SPA)      │  │     App      │  │     App      │  │    App     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                  │                  │                │        │
│         └──────────────────┴─────────┬────────┴────────────────┘        │
│                                      │                                  │
│                              HTTPS / WSS                                │
└──────────────────────────────────────┼──────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────┐
│                          API GATEWAY / LOAD BALANCER                     │
│                         (Nginx / AWS ALB / GCP LB)                      │
└──────────────────────────────────────┼──────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────┐
│                         BACKEND LAYER (NestJS)                          │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐ │
│  │ Auth Module  │ │  Product    │ │  Search     │ │  Messaging       │ │
│  │             │ │  Module     │ │  Module     │ │  Module (WS)     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐ │
│  │ Category    │ │  Package    │ │  Payment    │ │  Notification    │ │
│  │ Module      │ │  Module     │ │  Module     │ │  Module          │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐ │
│  │ Location    │ │  Review     │ │  AI/Reco    │ │  Admin           │ │
│  │ Module      │ │  Module     │ │  Module     │ │  Module          │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────┐
│                          DATA & SERVICES LAYER                          │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   MongoDB     │  │    Redis     │  │ Elasticsearch│                  │
│  │  (Primary DB) │  │   (Cache +   │  │  (Full-text  │                  │
│  │              │  │   Sessions)  │  │   Search)    │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  AWS S3 /    │  │  Firebase    │  │  Google Maps │                  │
│  │  Cloud       │  │  Cloud Msg   │  │  API         │                  │
│  │  Storage     │  │  + HMS Push  │  │              │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐                                    │
│  │  JazzCash /  │  │  AI/ML       │                                    │
│  │  EasyPaisa / │  │  Service     │                                    │
│  │  Card Gateway│  │  (Reco +     │                                    │
│  │              │  │   Chatbot)   │                                    │
│  └──────────────┘  └──────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Models

### User

```
Collection: users
{
  _id: ObjectId,
  email: String (unique, sparse),
  phone: String (unique, sparse),
  passwordHash: String,
  role: Enum ["admin", "seller", "buyer"],
  profile: {
    firstName: String,
    lastName: String,
    avatar: String (URL),
    location: {
      type: "Point",
      coordinates: [Number, Number]  // [lng, lat]
    },
    city: String,
    postalCode: String
  },
  emailVerified: Boolean (default: false),
  phoneVerified: Boolean (default: false),
  pendingEmailChange: {
    newEmail: String,
    verificationToken: String,
    expiresAt: Date
  },
  pendingPhoneChange: {
    newPhone: String,
    otpHash: String,
    expiresAt: Date,
    attempts: Number
  },
  verificationChangeCount: {
    count: Number,
    resetAt: Date
  },
  socialLogins: [{
    provider: Enum ["google", "facebook"],
    providerId: String
  }],
  mfa: {
    enabled: Boolean,
    totpSecret: String (encrypted),
    failedAttempts: Number,
    lockedUntil: Date
  },
  notificationPreferences: {
    messages: Boolean,
    offers: Boolean,
    productUpdates: Boolean,
    promotions: Boolean,
    packageAlerts: Boolean
  },
  deviceTokens: [{ platform: String, token: String }],
  adLimit: Number (default: 10),
  activeAdCount: Number (default: 0),
  status: Enum ["active", "suspended"],
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date,
  lastLoginDevice: String
}
Indexes: { email: 1 }, { phone: 1 }, { "socialLogins.provider": 1, "socialLogins.providerId": 1 }
```

### Category

```
Collection: categories
{
  _id: ObjectId,
  name: String,
  slug: String (unique),
  parentId: ObjectId (null for root categories),
  level: Number (1, 2, or 3),
  attributes: [{
    name: String,
    key: String,
    type: Enum ["text", "number", "select", "multiselect", "boolean"],
    options: [String] (for select/multiselect types),
    required: Boolean,
    unit: String (optional, e.g., "km", "sqft")
  }],
  filters: [{
    name: String,
    key: String,
    type: Enum ["range", "select", "multiselect", "boolean"],
    options: [String] (for select/multiselect),
    rangeMin: Number,
    rangeMax: Number
  }],
  isActive: Boolean,
  sortOrder: Number,
  createdAt: Date,
  updatedAt: Date
}
Indexes: { parentId: 1 }, { slug: 1 }, { level: 1 }
```

### Product Listing (Ad)

```
Collection: product_listings
{
  _id: ObjectId,
  sellerId: ObjectId (ref: users),
  title: String (max 150),
  description: String (max 5000),
  price: {
    amount: Number,
    currency: String (default: "PKR")
  },
  categoryId: ObjectId (ref: categories),
  categoryPath: [ObjectId] (ancestor category IDs for efficient querying),
  condition: Enum ["new", "used", "refurbished"],
  categoryAttributes: Map<String, Mixed> (dynamic key-value pairs based on category),
  images: [{
    url: String,
    thumbnailUrl: String,
    sortOrder: Number
  }],  // max 20
  video: {
    url: String,
    thumbnailUrl: String
  },  // max 1, optional
  location: {
    type: "Point",
    coordinates: [Number, Number],  // [lng, lat]
    city: String,
    area: String
  },
  contactInfo: {
    phone: String,
    email: String
  },
  status: Enum ["active", "pending_review", "rejected", "sold", "reserved", "deleted"],
  isFeatured: Boolean (default: false),
  featuredUntil: Date,
  rejectionReason: String,
  viewCount: Number (default: 0),
  favoriteCount: Number (default: 0),
  deletedAt: Date (for soft delete),
  createdAt: Date,
  updatedAt: Date
}
Indexes: { sellerId: 1 }, { categoryId: 1 }, { status: 1 },
         { "location": "2dsphere" }, { isFeatured: -1, createdAt: -1 },
         { createdAt: -1 }, { "categoryPath": 1 }
```

### Ad Package

```
Collection: ad_packages
{
  _id: ObjectId,
  name: String,
  type: Enum ["featured_ads", "ad_slots"],
  duration: Number (7, 15, or 30 days),
  quantity: Number (e.g., 5, 10, 20),
  defaultPrice: Number,
  categoryPricing: [{
    categoryId: ObjectId,
    price: Number
  }],
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
Indexes: { type: 1, duration: 1 }, { isActive: 1 }
```

### Package Purchase

```
Collection: package_purchases
{
  _id: ObjectId,
  sellerId: ObjectId (ref: users),
  packageId: ObjectId (ref: ad_packages),
  categoryId: ObjectId (ref: categories, optional),
  type: Enum ["featured_ads", "ad_slots"],
  quantity: Number,
  remainingQuantity: Number,
  duration: Number,
  price: Number,
  paymentMethod: Enum ["jazzcash", "easypaisa", "card"],
  paymentStatus: Enum ["pending", "completed", "failed", "refunded"],
  paymentTransactionId: String,
  activatedAt: Date,
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
Indexes: { sellerId: 1 }, { paymentStatus: 1 }, { expiresAt: 1 }
```

### Conversation & Message

```
Collection: conversations
{
  _id: ObjectId,
  productListingId: ObjectId (ref: product_listings),
  buyerId: ObjectId (ref: users),
  sellerId: ObjectId (ref: users),
  lastMessageAt: Date,
  lastMessagePreview: String,
  createdAt: Date
}
Indexes: { buyerId: 1 }, { sellerId: 1 }, { productListingId: 1 },
         { buyerId: 1, sellerId: 1, productListingId: 1 } (unique)

Collection: messages
{
  _id: ObjectId,
  conversationId: ObjectId (ref: conversations),
  senderId: ObjectId (ref: users),
  content: String,
  isRead: Boolean (default: false),
  createdAt: Date
}
Indexes: { conversationId: 1, createdAt: -1 }
```

### Review

```
Collection: reviews
{
  _id: ObjectId,
  reviewerId: ObjectId (ref: users, Buyer),
  sellerId: ObjectId (ref: users, Seller),
  productListingId: ObjectId (ref: product_listings),
  rating: Number (1-5),
  text: String (max 2000),
  status: Enum ["pending", "approved", "rejected"],
  createdAt: Date,
  updatedAt: Date
}
Indexes: { sellerId: 1 }, { productListingId: 1 }, { reviewerId: 1, productListingId: 1 } (unique)
```

### Favorite

```
Collection: favorites
{
  _id: ObjectId,
  userId: ObjectId (ref: users),
  productListingId: ObjectId (ref: product_listings),
  createdAt: Date
}
Indexes: { userId: 1, productListingId: 1 } (unique), { userId: 1 }
```

### User Activity (for AI Recommendations)

```
Collection: user_activities
{
  _id: ObjectId,
  userId: ObjectId (ref: users),
  action: Enum ["view", "search", "favorite", "dismiss", "contact"],
  productListingId: ObjectId (optional),
  searchQuery: String (optional),
  categoryId: ObjectId (optional),
  metadata: Map<String, Mixed>,
  createdAt: Date
}
Indexes: { userId: 1, createdAt: -1 }, { action: 1 }, { userId: 1, action: 1 }
```

## API Design

### Auth Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/register | Register new user (email/phone) | Public |
| POST | /api/auth/login | Login with credentials | Public |
| POST | /api/auth/social-login | Login/register via OAuth | Public |
| POST | /api/auth/refresh-token | Refresh JWT access token | Public (refresh token) |
| POST | /api/auth/forgot-password | Request password reset | Public |
| POST | /api/auth/reset-password | Reset password with token | Public |
| POST | /api/auth/mfa/enable | Enable MFA | Authenticated |
| POST | /api/auth/mfa/verify | Verify MFA code during login | Public (pending MFA) |
| POST | /api/auth/logout | Logout and invalidate tokens | Authenticated |
| POST | /api/auth/verify-email | Verify email via token link | Public |
| POST | /api/auth/verify-phone | Verify phone via SMS OTP | Public |
| POST | /api/auth/resend-verification | Resend verification email/SMS | Public |
| POST | /api/auth/change-email | Request email change (sends verification to new email) | Authenticated |
| POST | /api/auth/change-email/verify | Verify new email via token link | Public |
| POST | /api/auth/change-phone | Request phone change (sends OTP to new phone) | Authenticated |
| POST | /api/auth/change-phone/verify | Verify new phone via OTP | Authenticated |

### Product Listing Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/listings | Create new ad | Seller |
| GET | /api/listings | Search/list ads (public) | Public |
| GET | /api/listings/:id | Get ad details | Public |
| PATCH | /api/listings/:id | Update ad | Seller (owner) |
| PATCH | /api/listings/:id/status | Update ad status (sold/reserved) | Seller (owner) |
| DELETE | /api/listings/:id | Soft-delete ad | Seller (owner) / Admin |
| POST | /api/listings/:id/feature | Feature an ad | Seller (owner) |
| POST | /api/listings/:id/media | Upload images/video | Seller (owner) |

### Category Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/categories | Get category tree | Public |
| GET | /api/categories/:id | Get category with attributes/filters | Public |
| POST | /api/categories | Create category | Admin |
| PATCH | /api/categories/:id | Update category | Admin |
| DELETE | /api/categories/:id | Delete category | Admin |
| PATCH | /api/categories/:id/attributes | Manage category attributes | Admin |
| PATCH | /api/categories/:id/filters | Manage category filters | Admin |

### Package Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/packages | List available packages | Authenticated |
| GET | /api/packages/:id | Get package details | Authenticated |
| POST | /api/packages | Create package | Admin |
| PATCH | /api/packages/:id | Update package | Admin |
| POST | /api/packages/purchase | Purchase package(s) | Seller |
| GET | /api/packages/my-purchases | Get seller's purchases | Seller |
| POST | /api/packages/payment-callback | Payment gateway webhook | Public (verified) |

### Messaging Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/conversations | List user's conversations | Authenticated |
| GET | /api/conversations/:id/messages | Get messages (paginated) | Authenticated |
| POST | /api/conversations | Start conversation on a listing | Authenticated |
| WS | /ws/messaging | WebSocket for real-time messaging | Authenticated |

### Other Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/search | Full-text search with filters | Public |
| GET | /api/search/suggestions | Auto-suggestions | Public |
| GET | /api/recommendations | AI recommendations | Authenticated |
| POST | /api/recommendations/dismiss | Dismiss recommendation | Authenticated |
| POST | /api/chatbot/message | Send message to AI chatbot | Authenticated |
| POST | /api/reviews | Submit review | Buyer |
| GET | /api/reviews/listing/:id | Get reviews for listing | Public |
| GET | /api/reviews/seller/:id | Get reviews for seller | Public |
| GET/POST/DELETE | /api/favorites | Manage favorites | Authenticated |
| GET | /api/users/me | Get current user profile | Authenticated |
| PATCH | /api/users/me | Update profile | Authenticated |

### Admin Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/admin/users | List/search users | Admin |
| PATCH | /api/admin/users/:id/status | Suspend/reactivate user | Admin |
| PATCH | /api/admin/users/:id/role | Change user role | Admin |
| PATCH | /api/admin/users/:id/ad-limit | Override user ad limit | Admin |
| GET | /api/admin/listings/pending | Get moderation queue | Admin |
| PATCH | /api/admin/listings/:id/approve | Approve listing | Admin |
| PATCH | /api/admin/listings/:id/reject | Reject listing | Admin |
| GET | /api/admin/analytics | Get analytics data | Admin |
| GET | /api/admin/analytics/export | Export analytics report | Admin |
| GET | /api/admin/packages/purchases | List all package purchases | Admin |
| GET | /api/admin/payments | List all payment transactions | Admin |

## Component Design

### Backend Module Structure (NestJS)

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── guards/          (JwtAuthGuard, RolesGuard, ThrottlerGuard)
│   ├── decorators/      (Roles, CurrentUser)
│   ├── filters/         (HttpExceptionFilter)
│   ├── interceptors/    (TransformInterceptor, LoggingInterceptor)
│   ├── pipes/           (ValidationPipe)
│   └── middleware/       (CorsMiddleware, CsrfMiddleware)
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/      (JwtStrategy, GoogleStrategy, FacebookStrategy)
│   ├── guards/          (MfaGuard)
│   └── dto/
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── schemas/         (user.schema.ts)
├── categories/
│   ├── categories.module.ts
│   ├── categories.controller.ts
│   ├── categories.service.ts
│   └── schemas/         (category.schema.ts)
├── listings/
│   ├── listings.module.ts
│   ├── listings.controller.ts
│   ├── listings.service.ts
│   ├── media.service.ts  (image/video upload + compression)
│   └── schemas/         (product-listing.schema.ts)
├── search/
│   ├── search.module.ts
│   ├── search.controller.ts
│   └── search.service.ts (Elasticsearch integration)
├── packages/
│   ├── packages.module.ts
│   ├── packages.controller.ts
│   ├── packages.service.ts
│   └── schemas/         (ad-package.schema.ts, package-purchase.schema.ts)
├── payments/
│   ├── payments.module.ts
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   └── gateways/        (jazzcash.gateway.ts, easypaisa.gateway.ts, card.gateway.ts)
├── messaging/
│   ├── messaging.module.ts
│   ├── messaging.gateway.ts  (WebSocket gateway)
│   ├── messaging.controller.ts
│   ├── messaging.service.ts
│   └── schemas/         (conversation.schema.ts, message.schema.ts)
├── notifications/
│   ├── notifications.module.ts
│   ├── notifications.service.ts
│   └── providers/       (fcm.provider.ts, hms.provider.ts)
├── location/
│   ├── location.module.ts
│   ├── location.controller.ts
│   └── location.service.ts
├── reviews/
│   ├── reviews.module.ts
│   ├── reviews.controller.ts
│   ├── reviews.service.ts
│   └── schemas/         (review.schema.ts)
├── ai/
│   ├── ai.module.ts
│   ├── recommendation.service.ts
│   ├── chatbot.service.ts
│   └── schemas/         (user-activity.schema.ts)
├── favorites/
│   ├── favorites.module.ts
│   ├── favorites.controller.ts
│   ├── favorites.service.ts
│   └── schemas/         (favorite.schema.ts)
└── admin/
    ├── admin.module.ts
    ├── admin.controller.ts
    └── admin.service.ts
```

### Frontend Architecture (Angular Web)

```
src/app/
├── core/
│   ├── auth/            (AuthService, AuthGuard, JWT interceptor)
│   ├── services/        (ApiService, WebSocketService, NotificationService)
│   └── models/          (TypeScript interfaces for all entities)
├── shared/
│   ├── components/      (Header, Footer, SearchBar, CategoryNav, MapWidget)
│   └── pipes/           (DateFormat, PriceFormat, TruncateText)
├── features/
│   ├── home/            (HomePage with recommendations, featured ads)
│   ├── auth/            (Login, Register, ForgotPassword, MFA)
│   ├── listings/        (ListingDetail, CreateListing, EditListing, MyListings)
│   ├── search/          (SearchResults with dynamic category filters)
│   ├── categories/      (CategoryBrowse, CategoryListings)
│   ├── messaging/       (ConversationList, ChatWindow)
│   ├── profile/         (UserProfile, Settings, NotificationPrefs)
│   ├── favorites/       (FavoritesList)
│   ├── packages/        (PackageList, PurchaseFlow, MyPackages)
│   ├── reviews/         (ReviewList, WriteReview)
│   ├── chatbot/         (ChatbotWidget)
│   └── admin/
│       ├── dashboard/   (AnalyticsDashboard)
│       ├── users/       (UserManagement)
│       ├── listings/    (ModerationQueue)
│       ├── categories/  (CategoryManager with attribute/filter config)
│       ├── packages/    (PackageManager, PricingConfig)
│       └── payments/    (PaymentTransactions)
└── app-routing.module.ts
```

### Mobile Architecture (Flutter)

```
lib/
├── main.dart
├── app/
│   ├── app.dart
│   └── routes.dart
├── core/
│   ├── api/             (ApiClient, interceptors)
│   ├── auth/            (AuthProvider, token storage)
│   ├── storage/         (Hive/SQLite for offline cache)
│   └── services/        (LocationService, NotificationService, WebSocketService)
├── models/              (User, Listing, Category, Package, Message, Review)
├── providers/           (Riverpod/Bloc state management)
├── features/
│   ├── home/
│   ├── auth/
│   ├── listings/
│   ├── search/
│   ├── categories/
│   ├── messaging/
│   ├── profile/
│   ├── favorites/
│   ├── packages/
│   ├── reviews/
│   ├── chatbot/
│   └── admin/
├── widgets/             (Shared reusable widgets)
└── utils/               (Formatters, validators, constants)
```

## Key Technical Decisions

### Search: Elasticsearch
Product search uses Elasticsearch for full-text search, auto-suggestions, and dynamic category-specific filtering. MongoDB change streams sync product data to Elasticsearch in near real-time. Featured ads are boosted in search scoring.

### Real-time Messaging: WebSockets via NestJS Gateway
The messaging module uses NestJS WebSocket gateways (Socket.IO) for real-time message delivery. Messages are persisted to MongoDB and offline users receive push notifications via FCM/HMS.

### Media Storage: Cloud Object Storage (S3/GCS)
Images and videos are uploaded to S3 or GCS via presigned URLs. A background job compresses images and generates thumbnails using Sharp. Video validation enforces the 1-video-per-ad limit.

### Caching: Redis
Redis is used for JWT token blacklisting, session management, rate limiting counters, popular search term caching, and category tree caching.

### Payment Integration
The Payment module implements a gateway adapter pattern with concrete implementations for JazzCash, EasyPaisa, and Credit/Debit Card processors. Each gateway handles redirect-based checkout flows and webhook callbacks for payment confirmation.

### AI Recommendations
User activity events (views, searches, favorites, dismissals) are tracked in the user_activities collection. A scheduled job (cron, every 24h) processes activity data to update per-user recommendation models. Cold-start users see trending/popular items in their location.

### Offline Support (Mobile)
Flutter uses Hive or SQLite for local caching of previously loaded listings and draft ads. A sync service reconciles local changes with the server when connectivity is restored.

### Category-Specific Dynamic Forms
Category attributes and filters are stored as configurable arrays in the categories collection. The frontend dynamically renders form fields (for ad creation) and filter panels (for search) based on the category's attribute/filter definitions fetched from the API.

## UI/UX Design

### Design Philosophy

Move away from OLX's utilitarian, text-heavy classified-ad aesthetic toward a modern, visually immersive marketplace experience inspired by platforms like Airbnb, Depop, and Pinterest. The design prioritizes visual discovery, smooth micro-interactions, and a content-first approach where product imagery drives the experience.

### Design System

#### Color Palette
- Primary: Deep Teal (#0D7377) — trust, professionalism, distinct from OLX's blue/yellow
- Secondary: Warm Coral (#FF6B6B) — CTAs, featured badges, urgency
- Accent: Golden Amber (#F5A623) — ratings, premium/featured indicators
- Neutrals: Slate Gray (#2D3436) for text, Light Gray (#F8F9FA) for backgrounds, Pure White (#FFFFFF) for cards
- Success: Emerald (#00B894), Error: Crimson (#E74C3C), Warning: Amber (#FDCB6E)

#### Typography
- Headings: Inter (bold, clean geometric sans-serif)
- Body: Inter (regular/medium)
- Monospace: JetBrains Mono (for prices, codes)
- Scale: 12px / 14px / 16px / 20px / 24px / 32px / 40px

#### Spacing & Grid
- 8px base unit grid system
- 12-column responsive grid (web), 4-column (mobile)
- Card border-radius: 16px (softer, more modern than OLX's sharp corners)
- Consistent 16px/24px padding on cards and sections

#### Elevation & Shadows
- Cards: `0 2px 8px rgba(0,0,0,0.08)` (subtle, not flat)
- Hover state: `0 8px 24px rgba(0,0,0,0.12)` with slight scale(1.02) transform
- Modals/Sheets: `0 16px 48px rgba(0,0,0,0.16)`

### Key Differentiators from OLX

1. Visual-First Grid Layout: Pinterest-style masonry grid for listings instead of OLX's uniform list/grid. Images are hero-sized, not thumbnails. Cards adapt to image aspect ratio.

2. Immersive Product Detail: Full-bleed image gallery with swipe gestures (not a small carousel). Sticky bottom bar with price + CTA instead of cluttered sidebar. Seller profile card with trust score, response time, and verification badges.

3. Smart Category Navigation: Horizontal scrollable category chips with icons (not a dropdown menu). Visual category cards on homepage with lifestyle imagery. Breadcrumb trail with animated transitions between levels.

4. Contextual Search Experience: Full-screen search overlay with recent searches, trending terms, and AI suggestions. Filter panel slides in as a bottom sheet (mobile) or collapsible sidebar (web) — not a separate page. Active filters shown as dismissible chips above results.

5. Conversational Messaging: WhatsApp-style chat bubbles with read receipts and typing indicators. Quick-reply suggestions ("Is this still available?", "What's your best price?"). Product card embedded at the top of each conversation thread.

6. Seller Dashboard (not just "My Ads"): Analytics cards showing views, favorites, messages per listing. Performance insights ("Your car listing got 3x more views than average"). Package usage meter and featured ad status.

### Page Layouts

#### Homepage (Web)
```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  [Search Bar ───────────────]  [Location ▼]  👤  │
│  ─────────────────────────────────────────────────────── │
│  [🚗 Cars] [📱 Phones] [🏠 Property] [👗 Fashion] [→]   │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  ✨ Featured Ads                                    →    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │      │
│  │ ▓ IMG ▓ │ │ ▓ IMG ▓ │ │ ▓ IMG ▓ │ │ ▓ IMG ▓ │      │
│  │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │      │
│  │ Title   │ │ Title   │ │ Title   │ │ Title   │      │
│  │ Rs 500K │ │ Rs 25K  │ │ Rs 1.2M │ │ Rs 80K  │      │
│  │ 📍 City │ │ 📍 City │ │ 📍 City │ │ 📍 City │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                          │
│  🎯 Recommended for You                            →    │
│  ┌───────┐ ┌───────────┐ ┌───────┐ ┌───────────┐       │
│  │▓▓▓▓▓▓▓│ │ ▓▓▓▓▓▓▓▓▓ │ │▓▓▓▓▓▓▓│ │ ▓▓▓▓▓▓▓▓▓ │       │
│  │▓▓▓▓▓▓▓│ │ ▓▓▓▓▓▓▓▓▓ │ │▓▓▓▓▓▓▓│ │ ▓▓▓▓▓▓▓▓▓ │       │
│  │▓▓▓▓▓▓▓│ │ ▓▓▓▓▓▓▓▓▓ │ │▓▓▓▓▓▓▓│ │ ▓▓▓▓▓▓▓▓▓ │       │
│  │Title   │ │ Title     │ │Title   │ │ Title     │       │
│  │Rs 15K  │ │ Rs 45K    │ │Rs 8K   │ │ Rs 120K   │       │
│  └───────┘ └───────────┘ └───────┘ └───────────┘       │
│                                                          │
│  📍 Near You (Lahore)                               →    │
│  [Masonry grid of nearby listings...]                    │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│  [Footer: About | Help | Safety | Terms | Socials]       │
└──────────────────────────────────────────────────────────┘
```

#### Homepage (Mobile)
```
┌────────────────────────┐
│ [Logo]        📍🔔 👤  │
│ ┌────────────────────┐ │
│ │ 🔍 Search...       │ │
│ └────────────────────┘ │
│                        │
│ [🚗][📱][🏠][👗][⚡][→]│
│                        │
│ ✨ Featured            │
│ ┌────────┐┌────────┐  │
│ │▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓│  │
│ │▓ IMG  ▓││▓ IMG  ▓│  │
│ │▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓│  │
│ │Title   ││Title   │  │
│ │Rs 500K ││Rs 25K  │  │
│ └────────┘└────────┘  │
│                        │
│ 🎯 For You             │
│ ┌────────┐┌────────┐  │
│ │▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓│  │
│ │▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓│  │
│ │Title   ││Title   │  │
│ │Rs 15K  ││Rs 45K  │  │
│ └────────┘└────────┘  │
│ ┌────────┐┌────────┐  │
│ │▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓│  │
│ │▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓│  │
│ │Title   ││Title   │  │
│ │Rs 8K   ││Rs 120K │  │
│ └────────┘└────────┘  │
│                        │
├────────────────────────┤
│ 🏠  🔍  ➕  💬  👤    │
└────────────────────────┘
```

#### Product Detail Page
```
┌──────────────────────────────────────────────────────────┐
│  ← Back                                    ♡  ⤴ Share   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │              FULL-BLEED IMAGE GALLERY             │   │
│  │              (swipe / arrow navigation)           │   │
│  │                                                  │   │
│  │                   1 / 8  📷                      │   │
│  └──────────────────────────────────────────────────┘   │
│  [•] [○] [○] [○] [○] [○] [○] [○]                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Rs 1,250,000                    ⭐ FEATURED     │   │
│  │  Toyota Corolla 2020 - Excellent Condition        │   │
│  │  📍 Lahore, Punjab  •  Posted 2 hours ago         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Details ─────────────────────────────────────────┐  │
│  │  Make: Toyota    Model: Corolla    Year: 2020     │  │
│  │  Mileage: 35,000 km    Fuel: Petrol              │  │
│  │  Transmission: Automatic    Color: White          │  │
│  │  Condition: Used    Body: Sedan                   │  │
│  │  Registration: Lahore    Assembly: Local           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Description ─────────────────────────────────────┐  │
│  │  Well-maintained Toyota Corolla 2020 with full    │  │
│  │  service history. Single owner, no accidents...   │  │
│  │  [Read more]                                      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Seller ──────────────────────────────────────────┐  │
│  │  👤 Ahmed K.  ✓ Verified  ⭐ 4.8 (23 reviews)    │  │
│  │  Member since Jan 2024  •  Responds within 1 hr  │  │
│  │  [View Profile]                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Location ────────────────────────────────────────┐  │
│  │  ┌──────────────────────────────────────────┐     │  │
│  │  │           📍 MAP EMBED                   │     │  │
│  │  │           (Google Maps)                  │     │  │
│  │  └──────────────────────────────────────────┘     │  │
│  │  Johar Town, Lahore                               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Reviews ─────────────────────────────────────────┐  │
│  │  ⭐⭐⭐⭐⭐  "Great seller, very responsive"       │  │
│  │  ⭐⭐⭐⭐☆  "Product as described"                │  │
│  │  [See all 23 reviews]                             │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Similar Listings                            →    │   │
│  │  [Card] [Card] [Card] [Card]                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ════════════════════════════════════════════════════    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Rs 1,250,000     [📞 Call]  [💬 Chat]           │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

#### Search Results with Filters
```
┌──────────────────────────────────────────────────────────┐
│  ← Cars in Lahore                          🗺 Map View   │
│  ─────────────────────────────────────────────────────── │
│  [All ▼] [Make ▼] [Model ▼] [Price ▼] [Year ▼] [More]  │
│  ─────────────────────────────────────────────────────── │
│  Active: [Toyota ✕] [Under 2M ✕]     Clear All          │
│  ─────────────────────────────────────────────────────── │
│  234 results  •  Sort: [Relevance ▼]                     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ⭐ FEATURED                                     │    │
│  │ ┌──────────┐  Toyota Corolla 2020               │    │
│  │ │ ▓▓▓▓▓▓▓▓ │  Rs 1,250,000                     │    │
│  │ │ ▓ IMG  ▓ │  📍 Lahore  •  35,000 km          │    │
│  │ │ ▓▓▓▓▓▓▓▓ │  Automatic • Petrol • White       │    │
│  │ └──────────┘  ⭐ 4.8  •  2 hours ago       ♡   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐      │
│  │▓▓▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓▓▓│      │
│  │▓▓ IMG ▓▓▓││▓▓ IMG ▓▓▓││▓▓ IMG ▓▓▓││▓▓ IMG ▓▓▓│      │
│  │▓▓▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓▓▓││▓▓▓▓▓▓▓▓▓▓│      │
│  │Title     ││Title     ││Title     ││Title     │      │
│  │Rs 800K   ││Rs 1.5M   ││Rs 950K   ││Rs 2.1M   │      │
│  │📍 Lahore ││📍 Lahore ││📍 Isb    ││📍 Karachi│      │
│  │45K km  ♡ ││20K km  ♡ ││60K km  ♡ ││15K km  ♡│      │
│  └──────────┘└──────────┘└──────────┘└──────────┘      │
│                                                          │
│  [Load More...]                                          │
└──────────────────────────────────────────────────────────┘
```

#### Create Ad (Multi-Step Wizard)
```
Step 1: Category          Step 2: Details           Step 3: Media
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ What are you       │   │ Cars > Sedans       │   │ Add Photos & Video │
│ selling?           │   │                    │   │                    │
│                    │   │ Title:             │   │ ┌──┐┌──┐┌──┐┌──┐ │
│ ┌────┐ ┌────┐     │   │ [____________]     │   │ │📷││📷││📷││+ ││
│ │ 🚗 │ │ 📱 │     │   │                    │   │ └──┘└──┘└──┘└──┘ │
│ │Cars│ │Phone│     │   │ Make: [Toyota ▼]   │   │ Min 2, Max 20     │
│ └────┘ └────┘     │   │ Model: [Corolla ▼] │   │                    │
│ ┌────┐ ┌────┐     │   │ Year: [2020 ▼]     │   │ ┌──────────────┐  │
│ │ 🏠 │ │ 👗 │     │   │ Mileage: [35000]   │   │ │ 🎥 Add Video │  │
│ │Home│ │Fash│     │   │ Price: [1250000]   │   │ │   (Max 1)    │  │
│ └────┘ └────┘     │   │ Condition: [Used▼] │   │ └──────────────┘  │
│ [More categories]  │   │ Description:       │   │                    │
│                    │   │ [_______________]  │   │ [← Back]  [Next →]│
│         [Next →]   │   │ [← Back] [Next →] │   │                    │
└────────────────────┘   └────────────────────┘   └────────────────────┘

Step 4: Location          Step 5: Review & Post
┌────────────────────┐   ┌────────────────────┐
│ Where is the item? │   │ Review Your Ad      │
│                    │   │                    │
│ ┌────────────────┐ │   │ [Image Preview]    │
│ │   📍 MAP       │ │   │ Toyota Corolla 2020│
│ │   (pick pin)   │ │   │ Rs 1,250,000      │
│ └────────────────┘ │   │ 📍 Lahore         │
│                    │   │                    │
│ City: [Lahore ▼]   │   │ ┌────────────────┐│
│ Area: [Johar Town] │   │ │ ⭐ Feature Ad  ││
│                    │   │ │ Get 5x views   ││
│ Contact:           │   │ │ [Select Pack ▼]││
│ 📞 [03XX-XXXXXXX] │   │ └────────────────┘│
│ ✉ [email@...]     │   │                    │
│                    │   │ [← Back] [Post Ad]│
│ [← Back] [Next →]  │   │                    │
└────────────────────┘   └────────────────────┘
```

#### Messaging Interface
```
┌──────────────────────────────────────────────────────────┐
│  💬 Messages                                             │
│  ─────────────────────────────────────────────────────── │
│  ┌─────────────────┐ ┌──────────────────────────────┐   │
│  │ Conversations    │ │ Ahmed K. — Toyota Corolla    │   │
│  │                 │ │ ┌──────────────────────────┐ │   │
│  │ ┌─────────────┐ │ │ │ 🚗 Toyota Corolla 2020  │ │   │
│  │ │👤 Ahmed K.  │ │ │ │ Rs 1,250,000  [View Ad] │ │   │
│  │ │Toyota Corol.│ │ │ └──────────────────────────┘ │   │
│  │ │"Is it still"│ │ │                              │   │
│  │ │2 min ago  ● │ │ │        Hi, is this still     │   │
│  │ └─────────────┘ │ │        available?         💬 │   │
│  │                 │ │                              │   │
│  │ ┌─────────────┐ │ │  💬 Yes! It's available.     │   │
│  │ │👤 Sara M.   │ │ │     Would you like to        │   │
│  │ │iPhone 15 Pr.│ │ │     come see it?              │   │
│  │ │"Thanks!"    │ │ │                              │   │
│  │ │1 hr ago     │ │ │        What's your best      │   │
│  │ └─────────────┘ │ │        price?             💬 │   │
│  │                 │ │                              │   │
│  │ ┌─────────────┐ │ │  💬 I can do 1.1M, final.    │   │
│  │ │👤 Ali R.    │ │ │                    ✓✓ Read   │   │
│  │ │Samsung S24  │ │ │                              │   │
│  │ │"Deal!"      │ │ │ ┌──────────────────────────┐ │   │
│  │ │Yesterday    │ │ │ │ Quick: [Still available?] │ │   │
│  │ └─────────────┘ │ │ │ [Best price?] [Location?]│ │   │
│  │                 │ │ └──────────────────────────┘ │   │
│  │                 │ │                              │   │
│  │                 │ │ [Type a message...     📎 ➤] │   │
│  └─────────────────┘ └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

#### Seller Dashboard
```
┌──────────────────────────────────────────────────────────┐
│  👤 My Dashboard                                         │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │  👁 Views  │ │  ♡ Favs    │ │  💬 Msgs   │          │
│  │   1,247    │ │    89      │ │    34      │          │
│  │  ↑ 23%     │ │  ↑ 12%     │ │  ↑ 8%      │          │
│  └────────────┘ └────────────┘ └────────────┘          │
│                                                          │
│  ┌─ Ad Slots ────────────────────────────────────────┐  │
│  │  Free: 3/10 remaining  │  Paid: 15 slots (exp 7d) │  │
│  │  ████████░░░░░░░░░░░░  │  ████████████████░░░░░░  │  │
│  │                        │  [Buy More Slots]         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Featured Ads ────────────────────────────────────┐  │
│  │  2/5 featured slots used  •  Expires in 12 days   │  │
│  │  ████████░░░░░░░░░░░░░░  [Buy Featured Pack]      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  My Listings                              [+ Post Ad]   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🚗 Toyota Corolla 2020    ⭐Featured  Active     │   │
│  │    👁 456  ♡ 23  💬 12   Posted 2d ago           │   │
│  │    [Edit] [Mark Sold] [Feature] [Delete]          │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ 📱 iPhone 15 Pro Max      Active                  │   │
│  │    👁 234  ♡ 45  💬 8    Posted 5d ago           │   │
│  │    [Edit] [Mark Sold] [Feature] [Delete]          │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ 🏠 5 Marla House DHA      Sold                    │   │
│  │    👁 1.2K  ♡ 67  💬 34  Posted 2w ago           │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Animations & Micro-Interactions

- Page transitions: Shared element transitions between listing cards and detail pages (image morphs from card to full-bleed)
- Favorite toggle: Heart icon fills with a burst particle animation on tap
- Pull-to-refresh: Custom branded loading animation (not default spinner)
- Skeleton loading: Shimmer effect placeholders while content loads (not blank screens)
- Filter chips: Smooth slide-in/out with spring physics when added/removed
- Chat messages: Slide-up entrance with subtle bounce
- Image gallery: Pinch-to-zoom with momentum, swipe with parallax effect
- Bottom navigation (mobile): Active tab icon scales up with color fill animation
- Post ad wizard: Step indicator with animated progress bar between steps
- Toast notifications: Slide down from top with auto-dismiss and swipe-to-dismiss

### Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile S | 320px | Single column, bottom nav |
| Mobile L | 425px | Single column, bottom nav |
| Tablet | 768px | 2-column grid, side nav option |
| Laptop | 1024px | 3-column grid, top nav |
| Desktop | 1440px | 4-column grid, top nav, sidebar filters |
| Wide | 1920px+ | 5-column grid, max-width container |

### Dark Mode

Full dark mode support with automatic system preference detection and manual toggle. Dark palette: Background (#1A1A2E), Surface (#16213E), Card (#0F3460), Text (#E8E8E8). All colors maintain WCAG AA contrast ratios in both modes.

### Admin Dashboard UI

The admin panel uses a separate layout with a persistent left sidebar navigation, data tables with inline actions, chart widgets (Chart.js/D3), and a notification center. It follows a dashboard-first approach with key metrics visible on login, unlike OLX's basic admin tools.

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                  CI/CD Pipeline                  │
│            (GitHub Actions / Jenkins)            │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │  Lint +   │  │  Unit +  │  │  Build Docker │ │
│  │  Type     │→ │  Integ   │→ │  Images +     │ │
│  │  Check    │  │  Tests   │  │  Push to ECR  │ │
│  └──────────┘  └──────────┘  └───────┬───────┘ │
└──────────────────────────────────────┼──────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  ▼                   │
                    │  ┌──────────────────────────────┐   │
                    │  │   Container Orchestration     │   │
                    │  │   (ECS / EKS / GKE)          │   │
                    │  │                              │   │
                    │  │  ┌────────┐  ┌────────┐     │   │
                    │  │  │ API    │  │ API    │     │   │
                    │  │  │ Pod 1  │  │ Pod 2  │ ... │   │
                    │  │  └────────┘  └────────┘     │   │
                    │  └──────────────────────────────┘   │
                    │                                     │
                    │  ┌─────────┐ ┌─────────┐ ┌──────┐ │
                    │  │MongoDB  │ │ Redis   │ │ ES   │ │
                    │  │Atlas /  │ │ElastiC. │ │OpenS. │ │
                    │  │DocDB    │ │         │ │      │ │
                    │  └─────────┘ └─────────┘ └──────┘ │
                    │                                     │
                    │  ┌─────────┐ ┌─────────────────┐   │
                    │  │  S3 /   │ │  CloudFront /   │   │
                    │  │  GCS    │ │  CDN (Angular)  │   │
                    │  └─────────┘ └─────────────────┘   │
                    │         Cloud (AWS / GCP / Azure)   │
                    └─────────────────────────────────────┘
```

### Environment Strategy
- Staging: Auto-deployed on merge to main. Used for QA and integration testing.
- Production: Manual promotion from staging after approval. Blue-green or rolling deployment.

### Mobile Distribution
- iOS: Fastlane → Apple App Store
- Android: Fastlane → Google Play Store
- Huawei: Fastlane → Huawei AppGallery
- CI/CD handles automated build, signing, and upload for all three platforms.
