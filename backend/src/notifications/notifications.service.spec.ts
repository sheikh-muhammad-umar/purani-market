import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  NotificationsService,
  NotificationType,
} from './notifications.service';
import { FcmProvider } from './providers/fcm.provider';
import { HmsProvider } from './providers/hms.provider';
import { User } from '../users/schemas/user.schema';
import { Favorite } from '../favorites/schemas/favorite.schema';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let fcmProvider: FcmProvider;
  let hmsProvider: HmsProvider;
  let mockUserModel: any;
  let mockFavoriteModel: any;

  const userId = new Types.ObjectId();
  const listingId = new Types.ObjectId();

  const createMockUser = (overrides: any = {}) => ({
    _id: userId,
    notificationPreferences: {
      messages: true,
      offers: true,
      productUpdates: true,
      promotions: true,
      packageAlerts: true,
    },
    deviceTokens: [
      { platform: 'android', token: 'fcm-token-1' },
      { platform: 'ios', token: 'fcm-token-2' },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    mockUserModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(createMockUser()),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(createMockUser()),
      }),
    };

    mockFavoriteModel = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        FcmProvider,
        HmsProvider,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Favorite.name), useValue: mockFavoriteModel },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    fcmProvider = module.get<FcmProvider>(FcmProvider);
    hmsProvider = module.get<HmsProvider>(HmsProvider);

    jest.spyOn(fcmProvider, 'sendToMultipleDevices').mockResolvedValue(true);
    jest.spyOn(hmsProvider, 'sendToMultipleDevices').mockResolvedValue(true);
  });

  describe('sendToUser', () => {
    it('should send notification via FCM for android/ios tokens', async () => {
      const result = await service.sendToUser(
        userId.toString(),
        NotificationType.MESSAGES,
        {
          title: 'Test',
          body: 'Test body',
        },
      );

      expect(result).toBe(true);
      expect(fcmProvider.sendToMultipleDevices).toHaveBeenCalledWith(
        ['fcm-token-1', 'fcm-token-2'],
        { title: 'Test', body: 'Test body' },
      );
    });

    it('should route huawei tokens to HMS provider', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(
          createMockUser({
            deviceTokens: [
              { platform: 'huawei', token: 'hms-token-1' },
              { platform: 'android', token: 'fcm-token-1' },
            ],
          }),
        ),
      });

      await service.sendToUser(userId.toString(), NotificationType.MESSAGES, {
        title: 'Test',
        body: 'Body',
      });

      expect(fcmProvider.sendToMultipleDevices).toHaveBeenCalledWith(
        ['fcm-token-1'],
        expect.any(Object),
      );
      expect(hmsProvider.sendToMultipleDevices).toHaveBeenCalledWith(
        ['hms-token-1'],
        expect.any(Object),
      );
    });

    it('should skip notification when user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.sendToUser(
        userId.toString(),
        NotificationType.MESSAGES,
        {
          title: 'Test',
          body: 'Body',
        },
      );

      expect(result).toBe(false);
      expect(fcmProvider.sendToMultipleDevices).not.toHaveBeenCalled();
    });

    it('should skip notification when user has no device tokens', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(createMockUser({ deviceTokens: [] })),
      });

      const result = await service.sendToUser(
        userId.toString(),
        NotificationType.MESSAGES,
        {
          title: 'Test',
          body: 'Body',
        },
      );

      expect(result).toBe(false);
    });

    it('should skip notification when preference is disabled', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(
          createMockUser({
            notificationPreferences: {
              messages: false,
              offers: true,
              productUpdates: true,
              promotions: true,
              packageAlerts: true,
            },
          }),
        ),
      });

      const result = await service.sendToUser(
        userId.toString(),
        NotificationType.MESSAGES,
        {
          title: 'Test',
          body: 'Body',
        },
      );

      expect(result).toBe(false);
      expect(fcmProvider.sendToMultipleDevices).not.toHaveBeenCalled();
    });
  });

  describe('isNotificationEnabled', () => {
    it('should return true when preference is enabled', () => {
      const user = createMockUser();
      expect(
        service.isNotificationEnabled(user, NotificationType.MESSAGES),
      ).toBe(true);
    });

    it('should return false when preference is disabled', () => {
      const user = createMockUser({
        notificationPreferences: {
          messages: false,
          offers: true,
          productUpdates: true,
          promotions: true,
          packageAlerts: true,
        },
      });
      expect(
        service.isNotificationEnabled(user, NotificationType.MESSAGES),
      ).toBe(false);
    });

    it('should default to true when preferences are missing', () => {
      const user = createMockUser({
        notificationPreferences: undefined,
      });
      expect(
        service.isNotificationEnabled(user, NotificationType.MESSAGES),
      ).toBe(true);
    });
  });

  describe('sendNewMessageNotification', () => {
    it('should send with correct payload', async () => {
      const spy = jest.spyOn(service, 'sendToUser');
      await service.sendNewMessageNotification(
        userId.toString(),
        'John',
        'Hello!',
        'conv-123',
      );

      expect(spy).toHaveBeenCalledWith(
        userId.toString(),
        NotificationType.MESSAGES,
        {
          title: 'New message from John',
          body: 'Hello!',
          data: { type: 'new_message', conversationId: 'conv-123' },
        },
      );
    });
  });

  describe('sendPriceDropNotification', () => {
    it('should send with correct payload', async () => {
      const spy = jest.spyOn(service, 'sendToUser');
      await service.sendPriceDropNotification(
        userId.toString(),
        'iPhone 15',
        150000,
        120000,
        listingId.toString(),
      );

      expect(spy).toHaveBeenCalledWith(userId.toString(), 'productUpdates', {
        title: 'Price drop on a favorited item!',
        body: 'iPhone 15 dropped from Rs 150000 to Rs 120000',
        data: { type: 'price_drop', listingId: listingId.toString() },
      });
    });
  });

  describe('sendStatusChangeNotification', () => {
    it('should send with correct payload', async () => {
      const spy = jest.spyOn(service, 'sendToUser');
      await service.sendStatusChangeNotification(
        userId.toString(),
        'iPhone 15',
        'sold',
        listingId.toString(),
      );

      expect(spy).toHaveBeenCalledWith(userId.toString(), 'productUpdates', {
        title: 'Listing status updated',
        body: 'iPhone 15 is now sold',
        data: {
          type: 'status_change',
          listingId: listingId.toString(),
          status: 'sold',
        },
      });
    });
  });

  describe('sendNewOfferNotification', () => {
    it('should send with correct payload', async () => {
      const spy = jest.spyOn(service, 'sendToUser');
      await service.sendNewOfferNotification(
        userId.toString(),
        'Jane',
        'MacBook Pro',
        listingId.toString(),
      );

      expect(spy).toHaveBeenCalledWith(userId.toString(), 'offers', {
        title: 'New offer received',
        body: 'Jane is interested in "MacBook Pro"',
        data: { type: 'new_offer', listingId: listingId.toString() },
      });
    });
  });

  describe('sendPaymentSuccessNotification', () => {
    it('should send with correct payload', async () => {
      const spy = jest.spyOn(service, 'sendToUser');
      await service.sendPaymentSuccessNotification(
        userId.toString(),
        'Featured 30-day',
        5000,
      );

      expect(spy).toHaveBeenCalledWith(userId.toString(), 'packageAlerts', {
        title: 'Payment successful',
        body: 'Your purchase of "Featured 30-day" (Rs 5000) was successful',
        data: { type: 'payment_success' },
      });
    });
  });

  describe('sendAdLimitReachedNotification', () => {
    it('should send with correct payload', async () => {
      const spy = jest.spyOn(service, 'sendToUser');
      await service.sendAdLimitReachedNotification(userId.toString());

      expect(spy).toHaveBeenCalledWith(userId.toString(), 'packageAlerts', {
        title: 'Free ad limit reached',
        body: 'You have reached your free ad limit. Purchase a package to post more ads.',
        data: { type: 'ad_limit_reached' },
      });
    });
  });

  describe('sendFeaturedAdNotification', () => {
    it('should send with correct payload', async () => {
      const spy = jest.spyOn(service, 'sendToUser');
      await service.sendFeaturedAdNotification(
        userId.toString(),
        'My Car',
        listingId.toString(),
      );

      expect(spy).toHaveBeenCalledWith(userId.toString(), 'packageAlerts', {
        title: 'Your ad is now featured!',
        body: '"My Car" is now a featured ad and will appear at the top of search results',
        data: {
          type: 'featured_ad_activated',
          listingId: listingId.toString(),
        },
      });
    });
  });

  describe('sendFeaturedAdExpirationReminder', () => {
    it('should send with correct payload', async () => {
      const spy = jest.spyOn(service, 'sendToUser');
      await service.sendFeaturedAdExpirationReminder(
        userId.toString(),
        'My Car',
        listingId.toString(),
        3,
      );

      expect(spy).toHaveBeenCalledWith(userId.toString(), 'packageAlerts', {
        title: 'Featured ad expiring soon',
        body: '"My Car" featured status expires in 3 day(s)',
        data: { type: 'featured_ad_expiring', listingId: listingId.toString() },
      });
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update user preferences', async () => {
      await service.updateNotificationPreferences(userId.toString(), {
        messages: false,
        offers: true,
      });

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId.toString(),
        {
          $set: {
            'notificationPreferences.messages': false,
            'notificationPreferences.offers': true,
          },
        },
        { new: true },
      );
    });

    it('should throw when user not found', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateNotificationPreferences(userId.toString(), {
          messages: false,
        }),
      ).rejects.toThrow('User not found');
    });
  });

  describe('notifyFavoritedListingPriceChange', () => {
    it('should notify all users who favorited the listing on price drop', async () => {
      const favUser1 = new Types.ObjectId();
      const favUser2 = new Types.ObjectId();
      mockFavoriteModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { userId: favUser1, productListingId: listingId },
          { userId: favUser2, productListingId: listingId },
        ]),
      });

      const spy = jest
        .spyOn(service, 'sendPriceDropNotification')
        .mockResolvedValue(true);

      await service.notifyFavoritedListingPriceChange(
        listingId.toString(),
        'iPhone 15',
        150000,
        120000,
      );

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(
        favUser1.toString(),
        'iPhone 15',
        150000,
        120000,
        listingId.toString(),
      );
      expect(spy).toHaveBeenCalledWith(
        favUser2.toString(),
        'iPhone 15',
        150000,
        120000,
        listingId.toString(),
      );
    });

    it('should not notify when price increases', async () => {
      const spy = jest.spyOn(service, 'sendPriceDropNotification');

      await service.notifyFavoritedListingPriceChange(
        listingId.toString(),
        'iPhone 15',
        100000,
        150000,
      );

      expect(mockFavoriteModel.find).not.toHaveBeenCalled();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should handle no favorites gracefully', async () => {
      mockFavoriteModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const spy = jest.spyOn(service, 'sendPriceDropNotification');

      await service.notifyFavoritedListingPriceChange(
        listingId.toString(),
        'iPhone 15',
        150000,
        120000,
      );

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('notifyFavoritedListingStatusChange', () => {
    it('should notify all users who favorited the listing', async () => {
      const favUser1 = new Types.ObjectId();
      mockFavoriteModel.find.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            { userId: favUser1, productListingId: listingId },
          ]),
      });

      const spy = jest
        .spyOn(service, 'sendStatusChangeNotification')
        .mockResolvedValue(true);

      await service.notifyFavoritedListingStatusChange(
        listingId.toString(),
        'iPhone 15',
        'sold',
      );

      expect(spy).toHaveBeenCalledWith(
        favUser1.toString(),
        'iPhone 15',
        'sold',
        listingId.toString(),
      );
    });
  });
});
