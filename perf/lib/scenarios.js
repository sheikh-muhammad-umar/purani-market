'use strict';
/**
 * Endpoint scenarios.
 *
 * IDs are resolved from the live database by resolve-ids.js rather than
 * hardcoded, so a reseed does not silently turn every request into a 404
 * (which would make the whole suite look fast for the wrong reason).
 */

/** @param {Record<string,string>} ids */
function buildScenarios(ids) {
  return {
    // Cached read-through. Redis hit after first call.
    categoryTree: {
      name: 'GET /api/categories (cached tree)',
      path: '/api/categories',
    },

    // The category-chain N+1: level-3 category walks 3 findById, twice.
    inheritedAttributes: {
      name: 'GET /api/categories/:id/inherited-attributes (N+1 chain)',
      path: `/api/categories/${ids.CAT_L3}/inherited-attributes`,
    },

    // Hottest public path. ES + facets + 2x category chain walk.
    searchPlain: {
      name: 'GET /api/search (no filters)',
      path: '/api/search?page=1&limit=20',
    },
    // Category with real listings: exercises facet aggregation + the 2x
    // inherited-attribute chain walk against a non-empty result set.
    searchWithCategory: {
      name: 'GET /api/search?category=busy (facets + N+1)',
      path: `/api/search?category=${ids.CAT_BUSY}&page=1&limit=20`,
    },
    // Empty category: ES total=0 forces the Mongo 7-field regex fallback.
    searchEmptyCategory: {
      name: 'GET /api/search?category=empty (regex fallback)',
      path: `/api/search?category=${ids.CAT_L3}&page=1&limit=20`,
    },
    searchText: {
      name: 'GET /api/search?q=... (text query)',
      path: '/api/search?q=phone&page=1&limit=20',
    },
    searchPriceSort: {
      name: 'GET /api/search sort=price_asc (unindexed sort)',
      path: '/api/search?sort=price_asc&page=1&limit=20',
    },

    // Listing feed: countDocuments + deletedAt $exists on every call.
    listings: {
      name: 'GET /api/listings (feed + count)',
      path: '/api/listings?page=1&limit=20',
    },
    listingsDeepPage: {
      name: 'GET /api/listings deep page (skip cost)',
      path: '/api/listings?page=50&limit=20',
    },

    // 6 round trips: unfiltered count + $sample + find + 3 populates.
    shortsFeed: {
      name: 'GET /api/shorts/feed (6 round trips)',
      path: '/api/shorts/feed?limit=10',
    },

    // Cached SEO paths.
    seoHome: { name: 'GET /api/seo/home (cached)', path: '/api/seo/home' },
    seoListing: {
      name: 'GET /api/seo/listing/:id (cached)',
      path: `/api/seo/listing/${ids.LISTING_ID}`,
    },

    // Ad serve: resolveCategoryLineage per request.
    adServe: {
      name: 'GET /api/ads/serve (lineage walk)',
      path: '/api/ads/serve?placement=search_top',
    },

    // Static-ish reference points.
    locationProvinces: {
      name: 'GET /api/location/provinces',
      path: '/api/location/provinces',
    },
  };
}

module.exports = { buildScenarios };
