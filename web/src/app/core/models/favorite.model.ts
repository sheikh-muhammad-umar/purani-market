import { ListingImage, ListingLocation, ListingPrice, ListingStatus, ListingCondition } from './listing.model';

export interface FavoriteListingPopulated {
  _id: string;
  title: string;
  price: ListingPrice;
  status: ListingStatus;
  images: ListingImage[];
  condition: ListingCondition;
  location: ListingLocation;
  createdAt: Date;
  isFeatured: boolean;
}

export interface Favorite {
  _id: string;
  userId: string;
  productListingId: string | FavoriteListingPopulated;
  createdAt: Date;
}
