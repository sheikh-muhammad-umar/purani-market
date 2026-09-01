import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { User, UserRole, UserStatus } from '../users/schemas/user.schema.js';
import {
  ProductListing,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import { Conversation } from '../messaging/schemas/conversation.schema.js';
import { Review } from '../reviews/schemas/review.schema.js';
import {
  PackagePurchase,
  PaymentStatus,
} from '../packages/schemas/package-purchase.schema.js';
import { AdPackageType } from '../packages/schemas/ad-package.schema.js';
import { AuthService } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SearchSyncService } from '../search/search-sync.service.js';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { EntitlementKind } from '../packages/entitlements';

describe('AdminService', () => {
  let service: AdminService;
  let userModel: any;
  let listingModel: any;
  let conversationModel: any;
  let reviewModel: any;
  let packagePurchaseModel: any;
  let authService: any;
  let notificationsService: any;

  const mockUserId = new Types.ObjectId().toString();

  const mockUser = {
    _id: new Types.ObjectId(mockUserId),
    email: 'test@example.com',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    listingLimit: 10,
    save: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const chainable = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    userModel = {
      find: jest.fn().mockReturnValue(chainable),
      findById: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findByIdAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };

    listingModel = {
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findById: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      aggregate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };

    conversationModel = {
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };

    reviewModel = {
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };

    packagePurchaseModel = {
      aggregate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    authService = {
      invalidateAllSessions: jest.fn().mockResolvedValue(undefined),
    };

    notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(true),
      sendAccountSuspendedNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(ProductListing.name), useValue: listingModel },
        {
          provide: getModelToken(Conversation.name),
          useValue: conversationModel,
        },
        { provide: getModelToken(Review.name), useValue: reviewModel },
        {
          provide: getModelToken(PackagePurchase.name),
          useValue: packagePurchaseModel,
        },
        { provide: AuthService, useValue: authService },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: getModelToken('Category'),
          useValue: {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getModelToken('UserActivity'),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            aggregate: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
            countDocuments: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
          },
        },
        {
          provide: getModelToken('RejectionReason'),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            findById: jest.fn().mockReturnValue({
              lean: jest
                .fn()
                .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
            }),
            findByIdAndUpdate: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
            findByIdAndDelete: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
          },
        },
        {
          provide: getModelToken('DeletionReason'),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            findById: jest.fn().mockReturnValue({
              lean: jest
                .fn()
                .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
            }),
            findByIdAndUpdate: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
            findByIdAndDelete: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
          },
        },
        {
          provide: getModelToken('IdVerification'),
          useValue: {
            aggregate: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                'listing.activeDays': 30,
              };
              return config[key];
            }),
          },
        },
        {
          provide: SearchSyncService,
          useValue: {
            indexListing: jest.fn().mockResolvedValue(undefined),
            removeListing: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listUsers', () => {
    it('should return paginated users with defaults', async () => {
      const mockUsers = [{ _id: new Types.ObjectId(), email: 'a@b.com' }];
      const chainable = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUsers),
      };
      userModel.find.mockReturnValue(chainable);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.listUsers({});

      expect(result.data).toEqual(mockUsers);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should apply search filter', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      userModel.find.mockReturnValue(chainable);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.listUsers({ search: 'john' });

      const filterArg = userModel.find.mock.calls[0][0];
      expect(filterArg.$or).toBeDefined();
      expect(filterArg.$or).toHaveLength(4);
    });

    it('should apply role filter', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      userModel.find.mockReturnValue(chainable);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.listUsers({ role: UserRole.USER });

      const filterArg = userModel.find.mock.calls[0][0];
      expect(filterArg.role).toBe(UserRole.USER);
    });

    it('should apply status filter', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      userModel.find.mockReturnValue(chainable);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.listUsers({ status: UserStatus.SUSPENDED });

      const filterArg = userModel.find.mock.calls[0][0];
      expect(filterArg.status).toBe(UserStatus.SUSPENDED);
    });

    it('should apply date range filter', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      userModel.find.mockReturnValue(chainable);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.listUsers({
        registeredFrom: '2024-01-01',
        registeredTo: '2024-12-31',
      });

      const filterArg = userModel.find.mock.calls[0][0];
      expect(filterArg.createdAt).toBeDefined();
      expect(filterArg.createdAt.$gte).toEqual(new Date('2024-01-01'));
      expect(filterArg.createdAt.$lte).toEqual(new Date('2024-12-31'));
    });

    it('should calculate pagination correctly', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      userModel.find.mockReturnValue(chainable);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(50),
      });

      const result = await service.listUsers({ page: 3, limit: 10 });

      expect(chainable.skip).toHaveBeenCalledWith(20);
      expect(chainable.limit).toHaveBeenCalledWith(10);
      expect(result.totalPages).toBe(5);
    });
  });

  describe('getUserActivitySummary', () => {
    it('should return activity counts', async () => {
      listingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });
      conversationModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(3),
      });
      reviewModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.getUserActivitySummary(mockUserId);

      expect(result.listingsCount).toBe(5);
      expect(result.conversationsCount).toBe(3);
      expect(result.violationsCount).toBe(1);
    });
  });

  describe('updateUserStatus', () => {
    it('should suspend user and invalidate sessions', async () => {
      const user = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(undefined),
      };
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(user),
      });

      const result = await service.updateUserStatus(
        mockUserId,
        UserStatus.SUSPENDED,
      );

      expect(user.status).toBe(UserStatus.SUSPENDED);
      expect(user.save).toHaveBeenCalled();
      expect(authService.invalidateAllSessions).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should reactivate user without invalidating sessions', async () => {
      const user = {
        ...mockUser,
        status: UserStatus.SUSPENDED,
        save: jest.fn().mockResolvedValue(undefined),
      };
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(user),
      });

      await service.updateUserStatus(mockUserId, UserStatus.ACTIVE);

      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.save).toHaveBeenCalled();
      expect(authService.invalidateAllSessions).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateUserStatus('nonexistent', UserStatus.SUSPENDED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserRole', () => {
    it('should change role and invalidate sessions', async () => {
      const user = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(undefined),
      };
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(user),
      });

      await service.updateUserRole(mockUserId, UserRole.USER);

      expect(user.role).toBe(UserRole.USER);
      expect(user.save).toHaveBeenCalled();
      expect(authService.invalidateAllSessions).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateUserRole('nonexistent', UserRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateListingLimit', () => {
    it('should update listing limit', async () => {
      const updatedUser = { ...mockUser, listingLimit: 25 };
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedUser),
      });

      const result = await service.updateListingLimit(mockUserId, 25);

      expect(result.listingLimit).toBe(25);
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        { $set: { listingLimit: 25 } },
        { new: true },
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateListingLimit('nonexistent', 25),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPendingListings', () => {
    it('should return paginated pending listings sorted oldest first', async () => {
      const mockListings = [
        {
          _id: new Types.ObjectId(),
          title: 'Listing 1',
          status: 'pending_review',
        },
      ];
      const chainable = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockListings),
      };
      listingModel.find.mockReturnValue(chainable);
      listingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.getPendingListings(1, 20);

      expect(result.data).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(listingModel.find).toHaveBeenCalledWith({
        status: ListingStatus.PENDING_REVIEW,
      });
      expect(chainable.sort).toHaveBeenCalledWith({ createdAt: 1 });
    });

    it('should calculate pagination correctly', async () => {
      const chainable = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      listingModel.find.mockReturnValue(chainable);
      listingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(50),
      });

      const result = await service.getPendingListings(3, 10);

      expect(chainable.skip).toHaveBeenCalledWith(20);
      expect(chainable.limit).toHaveBeenCalledWith(10);
      expect(result.totalPages).toBe(5);
    });
  });

  describe('approveListing', () => {
    it('should set listing status to active', async () => {
      const mockListing = {
        _id: new Types.ObjectId(),
        title: 'Test Listing',
        status: ListingStatus.PENDING_REVIEW,
        sellerId: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      listingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockListing),
      });

      const result = await service.approveListing(mockListing._id.toString());

      expect(result.status).toBe(ListingStatus.ACTIVE);
      expect(mockListing.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent listing', async () => {
      listingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.approveListing('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rejectListing', () => {
    it('should set listing status to rejected and store reason', async () => {
      const sellerId = new Types.ObjectId();
      const reasonId = new Types.ObjectId();
      const mockListing = {
        _id: new Types.ObjectId(),
        title: 'Test Listing',
        status: ListingStatus.PENDING_REVIEW,
        sellerId,
        rejectionReason: undefined as string | undefined,
        rejectionReasonIds: [] as any[],
        rejectionNote: undefined as string | undefined,
        rejectionCount: 0,
        save: jest.fn().mockResolvedValue(undefined),
      };
      listingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockListing),
      });

      const result = await service.rejectListing(
        mockListing._id.toString(),
        [reasonId.toString()],
        'Inappropriate content',
      );

      expect(result.status).toBe(ListingStatus.REJECTED);
      expect(mockListing.save).toHaveBeenCalled();
    });

    it('should notify the seller about rejection', async () => {
      const sellerId = new Types.ObjectId();
      const listingId = new Types.ObjectId();
      const reasonId = new Types.ObjectId();
      const mockListing = {
        _id: listingId,
        title: 'Test Listing',
        status: ListingStatus.PENDING_REVIEW,
        sellerId,
        rejectionReason: undefined as string | undefined,
        rejectionReasonIds: [] as any[],
        rejectionNote: undefined as string | undefined,
        rejectionCount: 0,
        save: jest.fn().mockResolvedValue(undefined),
      };
      listingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockListing),
      });

      await service.rejectListing(
        listingId.toString(),
        [reasonId.toString()],
        'Policy violation',
      );

      expect(notificationsService.sendToUser).toHaveBeenCalledWith(
        sellerId.toString(),
        'productUpdates',
        expect.objectContaining({
          title: 'Listing rejected',
          body: expect.stringContaining('Policy violation'),
        }),
      );
    });

    it('should throw NotFoundException for non-existent listing', async () => {
      listingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.rejectListing(
          'nonexistent',
          [new Types.ObjectId().toString()],
          'reason',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAnalytics', () => {
    it('should return key metrics, time series, and category analytics', async () => {
      userModel.countDocuments
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(100) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(50) });
      listingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(200),
      });
      conversationModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(75),
      });

      const purchaseAggResult = [{ totalPurchases: 10, totalRevenue: 50000 }];
      const registrationsTs = [{ date: '2024-01-01', count: 5 }];
      const listingsTs = [{ date: '2024-01-01', count: 10 }];
      const conversationsTs = [{ date: '2024-01-01', count: 3 }];
      const purchasesTs = [{ date: '2024-01-01', count: 1 }];
      const categoryData = [
        { categoryId: '507f1f77bcf86cd799439011', count: 50 },
      ];

      packagePurchaseModel.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(purchaseAggResult),
      });

      // Time series aggregations: user, listing, conversation, purchase
      userModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(registrationsTs),
      });
      listingModel.aggregate = jest
        .fn()
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(listingsTs) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(categoryData),
        });
      conversationModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(conversationsTs),
      });
      packagePurchaseModel.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(purchasesTs),
      });

      const result = await service.getAnalytics('2024-01-01', '2024-06-30');

      expect(result.keyMetrics.totalUsers).toBe(100);
      expect(result.keyMetrics.activeUsers).toBe(50);
      expect(result.keyMetrics.totalListings).toBe(200);
      expect(result.keyMetrics.totalConversations).toBe(75);
      expect(result.keyMetrics.totalPackagePurchases).toBe(10);
      expect(result.keyMetrics.totalRevenue).toBe(50000);
      expect(result.timeSeries.registrations).toEqual(registrationsTs);
      expect(result.categoryAnalytics).toEqual([]);
    });

    it('should handle empty purchase aggregation', async () => {
      userModel.countDocuments
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(0) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(0) });
      listingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });
      conversationModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });
      packagePurchaseModel.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

      userModel.aggregate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      listingModel.aggregate = jest
        .fn()
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });
      conversationModel.aggregate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      packagePurchaseModel.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getAnalytics();

      expect(result.keyMetrics.totalPackagePurchases).toBe(0);
      expect(result.keyMetrics.totalRevenue).toBe(0);
    });
  });

  describe('exportAnalytics', () => {
    /**
     * exportAnalytics orchestrates the thirteen report methods, each of which has
     * its own tests. Stubbing them keeps this test about composition rather than
     * restating thirteen aggregation pipelines' worth of model mocks.
     */
    const stubReports = () => {
      const reports = [
        'getEngagementAnalytics',
        'getAppBannerStats',
        'getVoiceSearchAnalytics',
        'getCategoryPriceTrends',
        'getUserRetentionAnalytics',
        'getRevenueAnalytics',
        'getOtpAnalytics',
        'getSocialLoginAnalytics',
        'getTrafficAnalytics',
        'getListingFunnelAnalytics',
        'getBehaviourAnalytics',
        'getIdVerificationStats',
      ] as const;
      jest.spyOn(service, 'getAnalytics').mockResolvedValue({
        keyMetrics: { totalUsers: 10 },
        timeSeries: {},
        categoryAnalytics: [],
      } as any);
      for (const name of reports) {
        jest
          .spyOn(service, name as any)
          .mockResolvedValue({ stub: name } as any);
      }
    };

    it('should gather every report and stamp the range', async () => {
      stubReports();

      const result = await service.exportAnalytics('2024-01-01', '2024-12-31');

      expect(result.generatedAt).toBeDefined();
      expect(result.dateRange).toEqual({
        from: '2024-01-01',
        to: '2024-12-31',
      });
      expect(result.timezone).toBeDefined();
      expect(result.keyMetrics.totalUsers).toBe(10);
      // Every report has to reach the payload, or the export silently loses one.
      for (const block of [
        'engagement',
        'appBanner',
        'voiceSearch',
        'priceTrends',
        'retention',
        'revenue',
        'otp',
        'socialLogins',
        'traffic',
        'listingFunnel',
        'behaviour',
        'idVerification',
      ]) {
        expect(result[block as keyof typeof result]).toBeDefined();
      }
    });

    it('should pass the range through to each report', async () => {
      stubReports();

      await service.exportAnalytics('2024-03-01', '2024-03-31');

      expect(service.getTrafficAnalytics).toHaveBeenCalledWith(
        '2024-03-01',
        '2024-03-31',
      );
      expect(service.getBehaviourAnalytics).toHaveBeenCalledWith(
        '2024-03-01',
        '2024-03-31',
      );
    });
  });

  describe('buildAnalyticsCsv', () => {
    const emptyReport = (over: Record<string, any> = {}) =>
      ({
        generatedAt: '2024-06-15T00:00:00.000Z',
        dateRange: { from: '2024-01-01', to: '2024-12-31' },
        timezone: 'Asia/Karachi',
        keyMetrics: {},
        timeSeries: {},
        categoryAnalytics: [],
        engagement: {},
        appBanner: {},
        voiceSearch: {},
        priceTrends: {},
        retention: {},
        revenue: {},
        otp: {},
        socialLogins: {},
        traffic: {},
        listingFunnel: {},
        behaviour: {},
        idVerification: {},
        ...over,
      }) as any;

    it('should double inner quotes so a value cannot shift columns', () => {
      const csv = service.buildAnalyticsCsv(
        emptyReport({
          listingFunnel: {
            topListings: [
              {
                title: 'MacBook Pro 14" M3',
                views: 5,
                uniqueViewers: 2,
                contacts: 1,
                favorites: 0,
                conversations: 0,
              },
            ],
          },
        }),
      );
      const row = csv.split('\n').find((l) => l.includes('MacBook')) as string;
      expect(row).toContain('"MacBook Pro 14"" M3"');
      // Six quoted cells, so the embedded quote did not split the row.
      expect(row.split('","').length).toBe(6);
    });

    it('should serialise a non-primitive cell as JSON, not [object Object]', () => {
      const csv = service.buildAnalyticsCsv(
        emptyReport({
          listingFunnel: {
            topListings: [
              {
                title: { en: 'MacBook' },
                views: 1,
                uniqueViewers: 1,
                contacts: 0,
                favorites: 0,
                conversations: 0,
              },
            ],
          },
        }),
      );
      expect(csv).not.toContain('[object Object]');
      expect(csv).toContain('en');
      expect(csv).toContain('MacBook');
    });

    it('should state that a section is empty rather than omit it', () => {
      const csv = service.buildAnalyticsCsv(emptyReport());
      expect(csv).toContain('TOP SEARCHES');
      expect(csv).toContain('No data in this range');
      expect(csv).toContain('No campaign-tagged traffic in this range');
    });

    it('should carry the reporting timezone', () => {
      const csv = service.buildAnalyticsCsv(emptyReport());
      expect(csv).toContain('Asia/Karachi');
    });
  });

  describe('listPackagePurchases', () => {
    it('should return paginated purchases with defaults', async () => {
      const mockPurchases = [
        { _id: new Types.ObjectId(), sellerId: new Types.ObjectId() },
      ];
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPurchases),
      };
      packagePurchaseModel.find.mockReturnValue(chainable);
      packagePurchaseModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.listPackagePurchases({});

      expect(result.data).toEqual(mockPurchases);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should apply date range filter', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      packagePurchaseModel.find.mockReturnValue(chainable);
      packagePurchaseModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.listPackagePurchases({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      });

      const filterArg = packagePurchaseModel.find.mock.calls[0][0];
      expect(filterArg.createdAt).toBeDefined();
      expect(filterArg.createdAt.$gte).toEqual(new Date('2024-01-01'));
      expect(filterArg.createdAt.$lte).toEqual(new Date('2024-12-31'));
    });

    it('should apply seller, type, and status filters', async () => {
      const sellerId = new Types.ObjectId();
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      packagePurchaseModel.find.mockReturnValue(chainable);
      packagePurchaseModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.listPackagePurchases({
        sellerId: sellerId.toString(),
        type: AdPackageType.FEATURED_ADS,
        status: PaymentStatus.COMPLETED,
      });

      const filterArg = packagePurchaseModel.find.mock.calls[0][0];
      expect(filterArg.sellerId).toEqual(sellerId);
      expect(filterArg.type).toBe(AdPackageType.FEATURED_ADS);
      expect(filterArg.paymentStatus).toBe(PaymentStatus.COMPLETED);
    });
  });

  describe('listPayments', () => {
    it('should return paginated payment transactions', async () => {
      const mockPayments = [
        { _id: new Types.ObjectId(), paymentStatus: PaymentStatus.COMPLETED },
      ];
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPayments),
      };
      packagePurchaseModel.find.mockReturnValue(chainable);
      packagePurchaseModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.listPayments({});

      expect(result.data).toEqual(mockPayments);
      expect(result.total).toBe(1);
      const filterArg = packagePurchaseModel.find.mock.calls[0][0];
      expect(filterArg.paymentStatus.$in).toContain(PaymentStatus.COMPLETED);
      expect(filterArg.paymentStatus.$in).toContain(PaymentStatus.FAILED);
      expect(filterArg.paymentStatus.$in).toContain(PaymentStatus.REFUNDED);
    });

    it('should apply date and seller filters', async () => {
      const sellerId = new Types.ObjectId();
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      packagePurchaseModel.find.mockReturnValue(chainable);
      packagePurchaseModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.listPayments({
        dateFrom: '2024-01-01',
        sellerId: sellerId.toString(),
      });

      const filterArg = packagePurchaseModel.find.mock.calls[0][0];
      expect(filterArg.createdAt.$gte).toEqual(new Date('2024-01-01'));
      expect(filterArg.sellerId).toEqual(sellerId);
    });
  });

  describe('getSellerAdInfo', () => {
    it('should return seller ad info with active package slots', async () => {
      const sellerId = new Types.ObjectId();
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: sellerId,
          activeListingCount: 7,
          listingLimit: 10,
        }),
      });
      // Slots are credited to listingLimit and never spent from the purchase row,
      // so the figure is the granted quantity of each unexpired slots purchase —
      // here a legacy slots package plus a bundle that includes slots.
      packagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            purchaseType: 'ads',
            type: AdPackageType.AD_SLOTS,
            quantity: 10,
            remainingQuantity: 10,
            entitlements: [],
          },
          {
            purchaseType: 'ads',
            type: AdPackageType.BUNDLE,
            quantity: 8,
            remainingQuantity: 8,
            entitlements: [
              { kind: EntitlementKind.AD_SLOTS, quantity: 5, remaining: 5 },
              { kind: EntitlementKind.SHORTS, quantity: 3, remaining: 1 },
            ],
          },
        ]),
      });

      const result = await service.getSellerAdInfo(sellerId.toString());

      expect(result.sellerId).toBe(sellerId.toString());
      expect(result.activeListingCount).toBe(7);
      expect(result.listingLimit).toBe(10);
      expect(result.remainingFreeSlots).toBe(3);
      // 10 from the slots package + 5 from the bundle. The bundle's shorts are not
      // slots and must not be counted.
      expect(result.activePackageSlots).toBe(15);
    });

    it('should return zero package slots when none active', async () => {
      const sellerId = new Types.ObjectId();
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: sellerId,
          activeListingCount: 10,
          listingLimit: 10,
        }),
      });
      packagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getSellerAdInfo(sellerId.toString());

      expect(result.remainingFreeSlots).toBe(0);
      expect(result.activePackageSlots).toBe(0);
    });

    it('should throw NotFoundException for non-existent seller', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getSellerAdInfo(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
