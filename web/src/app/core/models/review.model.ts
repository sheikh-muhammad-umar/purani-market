export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  _id: string;
  reviewerId: string;
  sellerId: string;
  productListingId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}
