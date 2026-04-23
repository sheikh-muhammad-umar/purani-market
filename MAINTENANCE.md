# Maintenance & Deployment Notes

## Post-Deployment Tasks

### Elasticsearch Re-index Required

**When:** After any change to ES index mappings or sync service.
**How:** Run `node scripts/sync-es.js` or delete and recreate the index.
**Recent changes requiring re-index:**

- `selectedFeatures` field added to ES index mapping and sync (searchable text + keyword)
- Search query updated from `best_fields` to `most_fields` with phrase boosting

### Backend Rebuild

**When:** After any backend code change.
**How:** `cd backend && npm run build` then restart the server.
**Note:** The server runs from compiled `dist/` files. Source changes are NOT picked up until rebuilt.

---

## Search Architecture

### How Search Works

1. **Primary:** Elasticsearch with `function_score` for featured boost
2. **Fallback:** MongoDB regex search when ES is unavailable or returns empty

### ES Query Strategy (3-pronged scoring)

- `match_phrase` on title (boost 10) — exact phrase gets highest score
- `multi_match` with `most_fields` across title, description, brand, model, features — sums scores across fields
- `match_phrase_prefix` on title (boost 2) — catches partial/typing matches

### Progressive Search Relaxation

When a search with filters returns fewer results than the page size, the system progressively relaxes filters to fill the page:

1. **Strict search** runs first with all filters applied
2. If results < page size, filters are relaxed in order:
   - Remove `blockPhase`
   - Remove `area`/`areaId`
   - Remove `condition`
   - Remove `priceMin`/`priceMax`
3. Relaxed results are deduplicated against strict results
4. Relaxed items are marked with `_relaxed: true` so the frontend can optionally style them differently
5. Strict results always appear first

### Searchable Fields

| Field            | ES Type        | Boost                                  | Notes                |
| ---------------- | -------------- | -------------------------------------- | -------------------- |
| title            | text + keyword | ^3 (multi), ^5 (keyword), ^10 (phrase) | Primary search field |
| description      | text           | 1                                      | Full-text body       |
| brandName        | text + keyword | ^2                                     | Mobile brands        |
| vehicleBrandName | text + keyword | ^2                                     | Vehicle brands       |
| modelName        | text + keyword | ^2                                     | Model names          |
| variantName      | text + keyword | 1                                      | Variant names        |
| selectedFeatures | text + keyword | ^1.5                                   | Listing features     |

### MongoDB Fallback Fields

`title`, `description`, `brandName`, `vehicleBrandName`, `modelName`, `variantName`, `selectedFeatures` — all regex case-insensitive.

### Location Filtering

- **ID-based (preferred):** `provinceId`, `cityId`, `areaId` — exact keyword match
- **Name-based (legacy):** `province`, `city`, `area` — keyword match in ES, regex in MongoDB
- **Geo:** `lat`/`lng`/`radius` — `geo_distance` filter in ES only
- **Block/Phase:** `blockPhase` — keyword match

---

## ID Verification System

### Flow

1. User uploads 4 images (CNIC front/back + selfie with CNIC front/back)
2. Status set to `pending`
3. Admin reviews on `/admin/id-verifications`
4. Admin approves → user's `idVerified` flag set to `true`
5. Admin rejects with reason → user can resubmit

### Image Validation

- Allowed types: JPEG, PNG only (no WebP)
- Max size: 5MB per file
- Duplicate detection: SHA-256 hash comparison across all 4 files (backend + frontend)

### Statuses

`none` → `pending` → `approved` | `rejected` (can resubmit after rejection)

### Permissions

- `id_verification:view` — view verification requests
- `id_verification:review` — approve/reject verifications

---

## Listing Edit Behavior

### Re-review on Edit

Any edit to a listing sets its status to `pending_review`, regardless of previous status (active, inactive, etc.). The only exception is if it's already `pending_review`.

### Rejection Limit

Listings rejected 3+ times cannot be resubmitted. User must create a new listing.

### Location Dropdowns

Both create and edit listing use cascading dropdowns: Province → City → Area → Block/Phase. The edit form restores selections from stored `provinceId`/`cityId`/`areaId`.

---

## Duplicate Image Detection

### Backend (SHA-256)

- **Listings:** Hash stored per image in `ListingImage.hash` field. Each upload compared against existing hashes.
- **ID Verification:** All 4 file buffers hashed before upload. Rejects if any two match.

### Frontend (Web Crypto SHA-256)

- **Create Listing:** Hash computed per file in `processFiles`. Compared against already-added images.
- **ID Verification:** Hash tracked per field. Cross-checked against other fields on selection.

---

## Error Message Constants

### Backend

All error messages centralized in `backend/src/common/constants/error-messages.ts` (`ERROR` object).

### Frontend

User-facing messages in `web/src/app/core/constants/error-messages.ts` (`ERROR_MSG` object).

---

## Memory Leak Prevention

### Components with cleanup

- `EditListingComponent` — `Subject`-based `destroy$` with `takeUntil` on all HTTP subscriptions
- `CreateListingComponent` — `ngOnDestroy` revokes all `URL.createObjectURL` blob previews

### Pattern

Use `takeUntil(this.destroy$)` for chained/nested HTTP subscriptions. Single one-shot HTTP calls (Angular `HttpClient`) auto-complete and don't need cleanup.
