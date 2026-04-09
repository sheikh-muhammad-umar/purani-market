import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from '../auth/auth.service';

export type UserAction =
  | 'view' | 'search' | 'category_browse' | 'page_view'
  | 'favorite' | 'unfavorite' | 'contact' | 'share'
  | 'listing_create' | 'listing_edit' | 'listing_delete' | 'listing_status_change' | 'listing_feature'
  | 'login' | 'register' | 'logout'
  | 'message_sent' | 'conversation_start'
  | 'package_purchase' | 'payment_attempt'
  | 'location_change'
  | 'dismiss' | 'recommendation_click';

@Injectable({ providedIn: 'root' })
export class ActivityTrackerService {
  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
  ) {}

  track(action: UserAction, data?: {
    productListingId?: string;
    searchQuery?: string;
    categoryId?: string;
    metadata?: Record<string, any>;
  }): void {
    // Only track for authenticated users
    if (!this.auth.isAuthenticated()) return;

    this.api.post('/track', { action, ...data }).subscribe({
      error: () => {}, // silently fail — tracking should never block UX
    });
  }
}
