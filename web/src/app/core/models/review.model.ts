export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewImage {
  url: string;
  key: string;
}

/** Reviewer, as populated on public review reads. */
export interface ReviewAuthor {
  _id?: string;
  profile?: { firstName?: string; lastName?: string; avatar?: string };
}

export interface Review {
  _id: string;
  reviewerId: string | ReviewAuthor;
  /** The reviewed seller (user). A review is about the seller, not a listing. */
  sellerId: string;
  /** Optional listing context that prompted the review. */
  productListingId?: string | { _id: string; title?: string };
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  images?: ReviewImage[];
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}
