import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { EngagementService, ItemEngagement } from './engagement.service';
import { ApiService } from './api.service';

describe('EngagementService', () => {
  let service: EngagementService;
  let api: { get: ReturnType<typeof vi.fn> };

  const row: ItemEngagement = {
    itemId: 'listing-1',
    views: 120,
    likes: 9,
    chats: 3,
    calls: 5,
    whatsapp: 2,
    leads: 6,
  };

  beforeEach(() => {
    api = { get: vi.fn().mockReturnValue(of([row])) };
    service = new EngagementService(api as unknown as ApiService);
  });

  it('keys listing engagement by item id for row lookup', async () => {
    const byId = await new Promise<Map<string, ItemEngagement>>((resolve) =>
      service.getListingEngagement().subscribe(resolve),
    );

    expect(api.get).toHaveBeenCalledWith('/engagement/listings');
    expect(byId.get('listing-1')).toEqual(row);
  });

  it('asks the shorts endpoint for shorts engagement', async () => {
    await new Promise((resolve) => service.getShortsEngagement().subscribe(resolve));

    expect(api.get).toHaveBeenCalledWith('/engagement/shorts');
  });

  it('survives an empty response', async () => {
    api.get.mockReturnValue(of([]));

    const byId = await new Promise<Map<string, ItemEngagement>>((resolve) =>
      service.getListingEngagement().subscribe(resolve),
    );

    expect(byId.size).toBe(0);
  });

  it('survives a null body', async () => {
    // A seller with no listings gets nothing back rather than an empty array,
    // and mapping over that would throw while rendering the table.
    api.get.mockReturnValue(of(null));

    const byId = await new Promise<Map<string, ItemEngagement>>((resolve) =>
      service.getListingEngagement().subscribe(resolve),
    );

    expect(byId.size).toBe(0);
  });
});
