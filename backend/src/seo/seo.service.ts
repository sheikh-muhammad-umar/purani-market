import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model, Types } from 'mongoose';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { SlugService } from './slug.service.js';
import { BreadcrumbItem } from './dto/breadcrumb-item.dto.js';
import { ListingSeoDto } from './dto/listing-seo.dto.js';
import { CategorySeoDto } from './dto/category-seo.dto.js';
import { SellerSeoDto } from './dto/seller-seo.dto.js';
import { HomeSeoDto } from './dto/home-seo.dto.js';
import { SearchSeoDto } from './dto/search-seo.dto.js';
import { PageSeoDto } from './dto/page-seo.dto.js';
import {
  CACHE_KEY_SEO_LISTING,
  CACHE_KEY_SEO_CATEGORY,
  CACHE_KEY_SEO_SELLER,
  CACHE_KEY_SEO_HOME,
  CACHE_KEY_SEO_SEARCH,
  CACHE_KEY_SEO_PAGE,
  CACHE_TTL_SEO_LISTING,
  CACHE_TTL_SEO_CATEGORY,
  CACHE_TTL_SEO_SELLER,
  CACHE_TTL_SEO_HOME,
  CACHE_TTL_SEO_SEARCH,
  CACHE_TTL_SEO_PAGE,
  SEO_BASE_URL,
  SEO_PLACEHOLDER_IMAGE,
  SEO_LOGO_URL,
  SEO_SITE_NAME,
  SEO_SELLER_FALLBACK_NAME,
  SEO_ROUTE_PATTERNS,
  SEO_ORG_DESCRIPTION,
  SEO_DEFAULT_OG_TYPE,
  SEO_DEFAULT_COUNTRY_CODE,
  SEO_SUPPORTED_LANGUAGES,
  STATIC_PAGE_SEO,
} from '../common/constants/index.js';
import type { FaqEntry } from '../common/constants/index.js';

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);

  constructor(
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly slugService: SlugService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * Try to get a value from Redis cache. Returns null on miss or Redis error.
   */
  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      this.logger.warn(`Redis cache GET failed for key "${key}": ${error}`);
    }
    return null;
  }

  /**
   * Try to set a value in Redis cache. Logs and swallows errors on failure.
   */
  private async cacheSet(
    key: string,
    value: unknown,
    ttl: number,
  ): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      this.logger.warn(`Redis cache SET failed for key "${key}": ${error}`);
    }
  }

  /**
   * Truncate a description to the given max length at a word boundary,
   * appending an ellipsis if truncated.
   *
   * If the description is already within the limit, it is returned unchanged.
   * Default maxLength is 160 characters.
   */
  truncateDescription(description: string, maxLength = 160): string {
    if (!description) {
      return '';
    }

    if (description.length <= maxLength) {
      return description;
    }

    // Reserve 3 characters for the ellipsis
    const limit = maxLength - 3;
    const truncated = description.slice(0, limit);

    // Find the last space to break at a word boundary
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > 0) {
      return truncated.slice(0, lastSpace) + '...';
    }

    // No space found — just hard-truncate
    return truncated + '...';
  }

  /**
   * Build a breadcrumb trail from a category path (array of category ObjectIds).
   * Queries each ancestor category and returns BreadcrumbItem[] with incrementing positions.
   */
  async buildBreadcrumb(
    categoryPath: Types.ObjectId[],
  ): Promise<BreadcrumbItem[]> {
    if (!categoryPath || categoryPath.length === 0) {
      return [];
    }

    const categories = await this.categoryModel
      .find({ _id: { $in: categoryPath } })
      .lean()
      .exec();

    // Build a lookup map by ID string
    const categoryMap = new Map<string, (typeof categories)[0]>();
    for (const cat of categories) {
      categoryMap.set(cat._id.toString(), cat);
    }

    // Build breadcrumb items in the order of categoryPath
    const breadcrumb: BreadcrumbItem[] = [];
    let position = 1;

    for (const catId of categoryPath) {
      const cat = categoryMap.get(catId.toString());
      if (cat) {
        const item = new BreadcrumbItem();
        item.name = cat.name;
        item.url = `${SEO_BASE_URL}${this.slugService.generateCategoryUrl(cat)}`;
        item.position = position;
        breadcrumb.push(item);
        position++;
      }
    }

    return breadcrumb;
  }

  /**
   * Build schema.org Product JSON-LD for a listing.
   * Includes conditional aggregateRating only when reviewCount > 0.
   */
  buildProductJsonLd(
    listing: ProductListing,
    seller: User,
    averageRating?: number | null,
    reviewCount?: number,
  ): Record<string, unknown> {
    const imageUrl =
      listing.images && listing.images.length > 0
        ? listing.images[0].url
        : SEO_PLACEHOLDER_IMAGE;

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: listing.title,
      description: this.truncateDescription(listing.description),
      image: imageUrl,
      offers: {
        '@type': 'Offer',
        price: listing.price.amount,
        priceCurrency: listing.price.currency,
        availability: 'https://schema.org/InStock',
      },
      seller: {
        '@type': 'Person',
        name:
          `${seller.profile.firstName} ${seller.profile.lastName}`.trim() ||
          SEO_SELLER_FALLBACK_NAME,
      },
    };

    // Conditional aggregateRating — only when reviewCount > 0
    if (reviewCount && reviewCount > 0 && averageRating != null) {
      jsonLd['aggregateRating'] = {
        '@type': 'AggregateRating',
        ratingValue: averageRating,
        reviewCount: reviewCount,
      };
    }

    return jsonLd;
  }

  /**
   * Build schema.org ItemList JSON-LD for a category page.
   */
  buildCategoryJsonLd(
    category: Category,
    listings: ProductListing[],
  ): Record<string, unknown> {
    const itemListElement = listings.map((listing, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SEO_BASE_URL}${this.slugService.generateListingUrl(listing)}`,
      name: listing.title,
    }));

    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: category.name,
      itemListElement,
    };
  }

  /**
   * Build schema.org Person JSON-LD for a seller profile page.
   */
  buildSellerJsonLd(seller: User): Record<string, unknown> {
    const name =
      `${seller.profile.firstName} ${seller.profile.lastName}`.trim() ||
      SEO_SELLER_FALLBACK_NAME;

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name,
      url: `${SEO_BASE_URL}${this.slugService.generateSellerUrl(seller._id.toString())}`,
    };

    if (seller.profile.city) {
      jsonLd['address'] = {
        '@type': 'PostalAddress',
        addressLocality: seller.profile.city,
      };
    }

    return jsonLd;
  }

  /**
   * Build schema.org WebSite JSON-LD with SearchAction for the home page.
   */
  buildWebsiteJsonLd(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SEO_SITE_NAME,
      url: SEO_BASE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SEO_BASE_URL}${SEO_ROUTE_PATTERNS.SEARCH}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    };
  }

  /**
   * Build schema.org BreadcrumbList JSON-LD from a BreadcrumbItem array.
   */
  buildBreadcrumbJsonLd(breadcrumb: BreadcrumbItem[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumb.map((item) => ({
        '@type': 'ListItem',
        position: item.position,
        name: item.name,
        item: item.url,
      })),
    };
  }

  /**
   * Get SEO metadata for a listing detail page.
   *
   * Queries the listing and its seller, builds the title using the template
   * "{title} - {currency} {amount} | marketplace.pk", truncates the description,
   * builds Product and BreadcrumbList JSON-LD, and constructs the canonical URL.
   *
   * Throws NotFoundException if the listing or seller is not found.
   */
  async getListingSeo(id: string): Promise<ListingSeoDto> {
    // Check Redis cache first
    const cacheKey = `${CACHE_KEY_SEO_LISTING}${id}`;
    const cached = await this.cacheGet<ListingSeoDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const listing = await this.listingModel.findById(id).lean().exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const seller = await this.userModel
      .findById(listing.sellerId)
      .lean()
      .exec();
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const sellerName =
      `${seller.profile.firstName} ${seller.profile.lastName}`.trim() ||
      SEO_SELLER_FALLBACK_NAME;

    const title = `${listing.title} - ${listing.price.currency} ${listing.price.amount} | ${SEO_SITE_NAME}`;
    const description = this.truncateDescription(listing.description);

    const imageUrl =
      listing.images && listing.images.length > 0
        ? listing.images[0].url
        : SEO_PLACEHOLDER_IMAGE;

    // Build breadcrumb from category path
    const breadcrumb = await this.buildBreadcrumb(listing.categoryPath || []);

    // No review system exists yet — default to null/0
    const averageRating: number | null = null;
    const reviewCount = 0;

    const productJsonLd = this.buildProductJsonLd(
      listing as unknown as ProductListing,
      seller as unknown as User,
      averageRating,
      reviewCount,
    );
    const breadcrumbJsonLd = this.buildBreadcrumbJsonLd(breadcrumb);

    const canonicalUrl = `${SEO_BASE_URL}${this.slugService.generateListingUrl(listing as unknown as Pick<ProductListing, '_id' | 'title'>)}`;

    const dto = new ListingSeoDto();
    dto.title = title;
    dto.description = description;
    dto.imageUrl = imageUrl;
    dto.price = listing.price.amount;
    dto.currency = listing.price.currency;
    dto.categoryBreadcrumb = breadcrumb;
    dto.sellerName = sellerName;
    dto.averageRating = averageRating;
    dto.reviewCount = reviewCount;
    dto.canonicalUrl = canonicalUrl;
    dto.productJsonLd = productJsonLd;
    dto.breadcrumbJsonLd = breadcrumbJsonLd;

    await this.cacheSet(cacheKey, dto, CACHE_TTL_SEO_LISTING);

    return dto;
  }

  /**
   * Get SEO metadata for a category page.
   *
   * Queries the category by slug, builds the title using the template
   * "{name} - Buy & Sell {name} in Pakistan | marketplace.pk",
   * builds breadcrumb and ItemList JSON-LD.
   *
   * Throws NotFoundException if the category is not found.
   */
  async getCategorySeo(slug: string): Promise<CategorySeoDto> {
    // Check Redis cache first
    const cacheKey = `${CACHE_KEY_SEO_CATEGORY}${slug}`;
    const cached = await this.cacheGet<CategorySeoDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const category = await this.categoryModel.findOne({ slug }).lean().exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const title = `${category.name} - Buy & Sell ${category.name} in Pakistan | ${SEO_SITE_NAME}`;
    const description = `Browse ${category.name} listings on ${SEO_SITE_NAME}. Find the best deals on ${category.name} in Pakistan.`;

    // Build breadcrumb: include parent categories + this category
    const breadcrumbPath: Types.ObjectId[] = [];
    if (category.parentId) {
      // Walk up the hierarchy to build the full path
      const ancestors = await this.buildCategoryAncestorPath(category);
      breadcrumbPath.push(...ancestors);
    }
    breadcrumbPath.push(category._id);
    const breadcrumb = await this.buildBreadcrumb(breadcrumbPath);

    // Count active listings in this category
    const listingCount = await this.listingModel
      .countDocuments({
        categoryPath: category._id,
        status: ListingStatus.ACTIVE,
      })
      .exec();

    // Fetch a sample of active listings for the ItemList JSON-LD
    const listings = await this.listingModel
      .find({
        categoryPath: category._id,
        status: ListingStatus.ACTIVE,
      })
      .limit(10)
      .lean()
      .exec();

    const itemListJsonLd = this.buildCategoryJsonLd(
      category as unknown as Category,
      listings as unknown as ProductListing[],
    );
    const breadcrumbJsonLd = this.buildBreadcrumbJsonLd(breadcrumb);

    const canonicalUrl = `${SEO_BASE_URL}${this.slugService.generateCategoryUrl(category as unknown as Pick<Category, 'slug'>)}`;

    const dto = new CategorySeoDto();
    dto.title = title;
    dto.description = this.truncateDescription(description);
    dto.breadcrumb = breadcrumb;
    dto.listingCount = listingCount;
    dto.canonicalUrl = canonicalUrl;
    dto.itemListJsonLd = itemListJsonLd;
    dto.breadcrumbJsonLd = breadcrumbJsonLd;

    await this.cacheSet(cacheKey, dto, CACHE_TTL_SEO_CATEGORY);

    return dto;
  }

  /**
   * Get SEO metadata for a seller profile page.
   *
   * Queries the seller by ID, builds the title using the template
   * "{name} - Seller Profile | marketplace.pk", includes city and
   * active listing count in the description.
   *
   * Throws NotFoundException if the seller is not found.
   */
  async getSellerSeo(id: string): Promise<SellerSeoDto> {
    // Check Redis cache first
    const cacheKey = `${CACHE_KEY_SEO_SELLER}${id}`;
    const cached = await this.cacheGet<SellerSeoDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const seller = await this.userModel.findById(id).lean().exec();
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const name =
      `${seller.profile.firstName} ${seller.profile.lastName}`.trim() ||
      SEO_SELLER_FALLBACK_NAME;

    const title = `${name} - Seller Profile | ${SEO_SITE_NAME}`;

    const city = seller.profile.city || '';

    // Count active listings for this seller
    const activeListingCount = await this.listingModel
      .countDocuments({
        sellerId: seller._id,
        status: ListingStatus.ACTIVE,
      })
      .exec();

    const descriptionParts = [`${name} on ${SEO_SITE_NAME}.`];
    if (city) {
      descriptionParts.push(`Based in ${city}.`);
    }
    descriptionParts.push(
      `${activeListingCount} active listing${activeListingCount !== 1 ? 's' : ''}.`,
    );
    const description = this.truncateDescription(descriptionParts.join(' '));

    const avatarUrl = seller.profile.avatar || SEO_PLACEHOLDER_IMAGE;

    const personJsonLd = this.buildSellerJsonLd(seller as unknown as User);

    const canonicalUrl = `${SEO_BASE_URL}${this.slugService.generateSellerUrl(seller._id.toString())}`;

    const dto = new SellerSeoDto();
    dto.title = title;
    dto.description = description;
    dto.avatarUrl = avatarUrl;
    dto.city = city;
    dto.memberSince = seller.createdAt;
    dto.isVerified = seller.idVerified || false;
    dto.activeListingCount = activeListingCount;
    dto.canonicalUrl = canonicalUrl;
    dto.personJsonLd = personJsonLd;

    await this.cacheSet(cacheKey, dto, CACHE_TTL_SEO_SELLER);

    return dto;
  }

  /**
   * Get SEO metadata for the home page.
   *
   * Returns a static title "marketplace.pk - Buy & Sell in Pakistan",
   * builds WebSite JSON-LD with SearchAction, and includes featured
   * top-level category names.
   */
  async getHomeSeo(): Promise<HomeSeoDto> {
    // Check Redis cache first
    const cached = await this.cacheGet<HomeSeoDto>(CACHE_KEY_SEO_HOME);
    if (cached) {
      return cached;
    }

    const title = `${SEO_SITE_NAME} - Buy & Sell in Pakistan`;
    const description = `Buy and sell new and used products in Pakistan. Find the best deals on electronics, vehicles, property, and more on ${SEO_SITE_NAME}.`;

    // Fetch top-level (level 1) active categories as featured categories
    const topCategories = await this.categoryModel
      .find({ level: 1, isActive: true })
      .sort({ sortOrder: 1 })
      .lean()
      .exec();

    const featuredCategories = topCategories.map((cat) => cat.name);

    const websiteJsonLd = this.buildWebsiteJsonLd();

    const canonicalUrl = SEO_BASE_URL;

    const dto = new HomeSeoDto();
    dto.title = title;
    dto.description = description;
    dto.featuredCategories = featuredCategories;
    dto.canonicalUrl = canonicalUrl;
    dto.websiteJsonLd = websiteJsonLd;
    dto.organizationJsonLd = this.buildOrganizationJsonLd();

    await this.cacheSet(CACHE_KEY_SEO_HOME, dto, CACHE_TTL_SEO_HOME);

    return dto;
  }

  /**
   * Get SEO metadata for a search results page.
   *
   * Builds a title "Search: {query} | marketplace.pk" (or fallback
   * "Search Listings | marketplace.pk" for empty/missing query),
   * a description, and a canonical URL retaining only the `q` parameter.
   *
   * Results are cached with a 10-minute TTL.
   */
  async getSearchSeo(query?: string): Promise<SearchSeoDto> {
    const trimmedQuery = query?.trim() || '';
    const cacheKey = `${CACHE_KEY_SEO_SEARCH}${trimmedQuery}`;

    const cached = await this.cacheGet<SearchSeoDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const dto = new SearchSeoDto();

    if (trimmedQuery) {
      dto.title = `Search: ${trimmedQuery} | ${SEO_SITE_NAME}`;
      dto.description = `Find ${trimmedQuery} listings on ${SEO_SITE_NAME}. Browse results and discover the best deals in Pakistan.`;
      dto.canonicalUrl = `${SEO_BASE_URL}${SEO_ROUTE_PATTERNS.SEARCH}?q=${encodeURIComponent(trimmedQuery)}`;
    } else {
      dto.title = `Search Listings | ${SEO_SITE_NAME}`;
      dto.description = `Search listings on ${SEO_SITE_NAME}. Browse results and discover the best deals in Pakistan.`;
      dto.canonicalUrl = `${SEO_BASE_URL}${SEO_ROUTE_PATTERNS.SEARCH}`;
    }

    await this.cacheSet(cacheKey, dto, CACHE_TTL_SEO_SEARCH);

    return dto;
  }

  /**
   * Get SEO metadata for a static page (about, terms, privacy, etc.).
   *
   * Looks up the slug in the STATIC_PAGE_SEO constant map, builds a PageSeoDto
   * with title, description, canonical URL, ogType "website", and optional FAQ
   * JSON-LD if the page config includes FAQs.
   *
   * Throws NotFoundException if the slug is not found in the map.
   * Results are cached with a 24-hour TTL.
   */
  async getPageSeo(slug: string): Promise<PageSeoDto> {
    // Check Redis cache first
    const cacheKey = `${CACHE_KEY_SEO_PAGE}${slug}`;
    const cached = await this.cacheGet<PageSeoDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const pageConfig = STATIC_PAGE_SEO[slug];
    if (!pageConfig) {
      throw new NotFoundException('Page not found');
    }

    const dto = new PageSeoDto();
    dto.title = pageConfig.title;
    dto.description = pageConfig.description;
    dto.canonicalUrl = `${SEO_BASE_URL}${SEO_ROUTE_PATTERNS.PAGES}/${slug}`;
    dto.ogType = SEO_DEFAULT_OG_TYPE;

    if (pageConfig.faqs && pageConfig.faqs.length > 0) {
      dto.faqJsonLd = this.buildFaqJsonLd(pageConfig.faqs);
    }

    await this.cacheSet(cacheKey, dto, CACHE_TTL_SEO_PAGE);

    return dto;
  }

  /**
   * Build schema.org FAQPage JSON-LD from an array of question/answer pairs.
   *
   * Each FAQ entry becomes a Question object with an accepted Answer.
   */
  private buildFaqJsonLd(faqs: FaqEntry[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }

  /**
   * Build schema.org Organization JSON-LD for the home page.
   * Includes name, url, logo, description, contactPoint, sameAs, and address.
   */
  private buildOrganizationJsonLd(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SEO_SITE_NAME,
      url: SEO_BASE_URL,
      logo: SEO_LOGO_URL,
      description: SEO_ORG_DESCRIPTION,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Customer Service',
        availableLanguage: [...SEO_SUPPORTED_LANGUAGES],
      },
      sameAs: [],
      address: {
        '@type': 'PostalAddress',
        addressCountry: SEO_DEFAULT_COUNTRY_CODE,
      },
    };
  }

  /**
   * Walk up the category hierarchy to build the ancestor path for breadcrumbs.
   * Returns an array of ancestor ObjectIds from root to parent (excluding the category itself).
   */
  private async buildCategoryAncestorPath(
    category: Record<string, any>,
  ): Promise<Types.ObjectId[]> {
    const ancestors: Types.ObjectId[] = [];
    let currentParentId = category.parentId;

    while (currentParentId) {
      const parent = await this.categoryModel
        .findById(currentParentId)
        .lean()
        .exec();
      if (!parent) break;
      ancestors.unshift(parent._id);
      currentParentId = parent.parentId;
    }

    return ancestors;
  }
}
