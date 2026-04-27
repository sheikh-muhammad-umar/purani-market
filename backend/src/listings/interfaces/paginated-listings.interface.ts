import { ProductListingDocument } from '../schemas/product-listing.schema.js';

export interface PaginatedListings {
  data: ProductListingDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
