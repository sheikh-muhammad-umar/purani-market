import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PackagesService } from './packages.service';
import { ApiService } from './api.service';
import { API } from '../constants/api-endpoints';

describe('PackagesService', () => {
  let service: PackagesService;
  let apiMock: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi
        .fn()
        .mockReturnValue(of({ redirectUrl: 'https://pay.example', transactionId: 'T1' })),
    };
    service = new PackagesService(apiMock as unknown as ApiService);
  });

  describe('purchase', () => {
    /**
     * The endpoint takes a basket. Posting the flat argument verbatim was rejected
     * with "items must be an array", so no purchase started from the UI ever
     * reached the gateway — and because it failed before any purchase row was
     * usable, the missing categoryId below went unnoticed too.
     */
    it('wraps the package in the items array the endpoint expects', () => {
      service.purchase({ packageId: 'pkg1', paymentMethod: 'jazzcash' }).subscribe();

      expect(apiMock.post).toHaveBeenCalledWith(API.PACKAGES_PURCHASE, {
        paymentMethod: 'jazzcash',
        items: [{ packageId: 'pkg1' }],
      });
    });

    it('carries the category through when one was chosen', () => {
      // The purchase has to record the category it was priced for, or it can never
      // satisfy the create-listing picker, which matches purchases on it.
      service
        .purchase({ packageId: 'pkg1', paymentMethod: 'card', categoryId: 'cat9' })
        .subscribe();

      expect(apiMock.post).toHaveBeenCalledWith(API.PACKAGES_PURCHASE, {
        paymentMethod: 'card',
        items: [{ packageId: 'pkg1', categoryId: 'cat9' }],
      });
    });

    it('omits the category rather than sending an empty one', () => {
      service
        .purchase({ packageId: 'pkg1', paymentMethod: 'easypaisa', categoryId: '' })
        .subscribe();

      const body = apiMock.post.mock.calls[0][1] as {
        items: { categoryId?: string }[];
      };
      expect(body.items[0]).not.toHaveProperty('categoryId');
    });
  });
});
