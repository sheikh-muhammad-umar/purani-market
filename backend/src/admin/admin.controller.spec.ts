import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { UserRole, UserStatus } from '../users/schemas/user.schema.js';
import { ListingStatus } from '../listings/schemas/product-listing.schema.js';
import { Types } from 'mongoose';
import { Reflector } from '@nestjs/core';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: any;

  const mockUserId = new Types.ObjectId().toString();

  beforeEach(async () => {
    adminService = {
      listUsers: jest.fn(),
      getUserActivitySummary: jest.fn(),
      updateUserStatus: jest.fn(),
      updateUserRole: jest.fn(),
      updateAdLimit: jest.fn(),
      getPendingListings: jest.fn(),
      approveListing: jest.fn(),
      rejectListing: jest.fn(),
      getAnalytics: jest.fn(),
      exportAnalytics: jest.fn(),
      listPackagePurchases: jest.fn(),
      listPayments: jest.fn(),
      getSellerAdInfo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: adminService }, Reflector],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listUsers', () => {
    it('should return paginated users with activity summaries', async () => {
      const userId = new Types.ObjectId();
      const paginatedResult = {
        data: [{ _id: userId, email: 'test@example.com' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      const activitySummary = {
        listingsCount: 5,
        conversationsCount: 3,
        violationsCount: 0,
      };

      adminService.listUsers.mockResolvedValue(paginatedResult);
      adminService.getUserActivitySummary.mockResolvedValue(activitySummary);

      const result = await controller.listUsers({});

      expect(result.total).toBe(1);
      expect(result.data[0].activitySummary).toEqual(activitySummary);
      expect(adminService.getUserActivitySummary).toHaveBeenCalledWith(
        userId.toString(),
      );
    });

    it('should pass query params to service', async () => {
      adminService.listUsers.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const query = { page: 2, limit: 10, role: UserRole.SELLER };
      await controller.listUsers(query);

      expect(adminService.listUsers).toHaveBeenCalledWith(query);
    });

    it('should pass status filter to service', async () => {
      adminService.listUsers.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const query = { status: UserStatus.SUSPENDED };
      await controller.listUsers(query);

      expect(adminService.listUsers).toHaveBeenCalledWith(query);
    });
  });

  describe('updateUserStatus', () => {
    it('should suspend a user', async () => {
      adminService.updateUserStatus.mockResolvedValue({
        _id: new Types.ObjectId(mockUserId),
        status: UserStatus.SUSPENDED,
      });

      const result = await controller.updateUserStatus(mockUserId, {
        status: UserStatus.SUSPENDED,
      });

      expect(result.message).toContain('suspended');
      expect(adminService.updateUserStatus).toHaveBeenCalledWith(
        mockUserId,
        UserStatus.SUSPENDED,
      );
    });

    it('should reactivate a user', async () => {
      adminService.updateUserStatus.mockResolvedValue({
        _id: new Types.ObjectId(mockUserId),
        status: UserStatus.ACTIVE,
      });

      const result = await controller.updateUserStatus(mockUserId, {
        status: UserStatus.ACTIVE,
      });

      expect(result.message).toContain('active');
    });
  });

  describe('updateUserRole', () => {
    it('should change user role', async () => {
      adminService.updateUserRole.mockResolvedValue({
        _id: new Types.ObjectId(mockUserId),
        role: UserRole.SELLER,
      });

      const result = await controller.updateUserRole(mockUserId, {
        role: UserRole.SELLER,
      });

      expect(result.message).toContain('seller');
      expect(adminService.updateUserRole).toHaveBeenCalledWith(
        mockUserId,
        UserRole.SELLER,
      );
    });
  });

  describe('updateAdLimit', () => {
    it('should update ad limit', async () => {
      adminService.updateAdLimit.mockResolvedValue({
        _id: new Types.ObjectId(mockUserId),
        adLimit: 25,
      });

      const result = await controller.updateAdLimit(mockUserId, {
        adLimit: 25,
      });

      expect(result.message).toContain('25');
      expect(result.adLimit).toBe(25);
      expect(adminService.updateAdLimit).toHaveBeenCalledWith(mockUserId, 25);
    });
  });

  describe('getPendingListings', () => {
    it('should return paginated pending listings', async () => {
      const paginatedResult = {
        data: [{ _id: new Types.ObjectId(), title: 'Pending Listing' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      adminService.getPendingListings.mockResolvedValue(paginatedResult);

      const result = await controller.getPendingListings(1, 20);

      expect(result).toEqual(paginatedResult);
      expect(adminService.getPendingListings).toHaveBeenCalledWith(1, 20);
    });

    it('should pass page and limit params', async () => {
      adminService.getPendingListings.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      });

      await controller.getPendingListings(2, 10);

      expect(adminService.getPendingListings).toHaveBeenCalledWith(2, 10);
    });
  });

  describe('approveListing', () => {
    it('should approve a listing', async () => {
      const listingId = new Types.ObjectId();
      adminService.approveListing.mockResolvedValue({
        _id: listingId,
        status: ListingStatus.ACTIVE,
      });

      const result = await controller.approveListing(listingId.toString());

      expect(result.message).toBe('Listing approved');
      expect(result.status).toBe(ListingStatus.ACTIVE);
      expect(adminService.approveListing).toHaveBeenCalledWith(
        listingId.toString(),
      );
    });
  });

  describe('rejectListing', () => {
    it('should reject a listing with reason', async () => {
      const listingId = new Types.ObjectId();
      adminService.rejectListing.mockResolvedValue({
        _id: listingId,
        status: ListingStatus.REJECTED,
        rejectionReason: 'Inappropriate content',
      });

      const result = await controller.rejectListing(listingId.toString(), {
        rejectionReason: 'Inappropriate content',
      });

      expect(result.message).toBe('Listing rejected');
      expect(result.status).toBe(ListingStatus.REJECTED);
      expect(result.rejectionReason).toBe('Inappropriate content');
      expect(adminService.rejectListing).toHaveBeenCalledWith(
        listingId.toString(),
        'Inappropriate content',
      );
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics data without date params', async () => {
      const mockAnalytics = {
        keyMetrics: {
          totalUsers: 100,
          activeUsers: 50,
          totalListings: 200,
          totalConversations: 75,
          totalPackagePurchases: 10,
          totalRevenue: 50000,
        },
        timeSeries: {
          registrations: [{ date: '2024-01-01', count: 5 }],
          listings: [{ date: '2024-01-01', count: 10 }],
          conversations: [{ date: '2024-01-01', count: 3 }],
          purchases: [{ date: '2024-01-01', count: 1 }],
        },
        categoryAnalytics: [
          { categoryId: '507f1f77bcf86cd799439011', count: 50 },
        ],
      };
      adminService.getAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getAnalytics();

      expect(result).toEqual(mockAnalytics);
      expect(adminService.getAnalytics).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });

    it('should pass date params to service', async () => {
      adminService.getAnalytics.mockResolvedValue({
        keyMetrics: {},
        timeSeries: {},
        categoryAnalytics: [],
      });

      await controller.getAnalytics('2024-01-01', '2024-06-30');

      expect(adminService.getAnalytics).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-06-30',
      );
    });
  });

  describe('exportAnalytics', () => {
    it('should return exported analytics report', async () => {
      const mockExport = {
        generatedAt: '2024-06-15T00:00:00.000Z',
        dateRange: { from: '2024-01-01', to: '2024-06-30' },
        keyMetrics: {
          totalUsers: 100,
          activeUsers: 50,
          totalListings: 200,
          totalConversations: 75,
          totalPackagePurchases: 10,
          totalRevenue: 50000,
        },
        timeSeries: {
          registrations: [],
          listings: [],
          conversations: [],
          purchases: [],
        },
        categoryAnalytics: [],
      };
      adminService.exportAnalytics.mockResolvedValue(mockExport);

      const result = await controller.exportAnalytics(
        '2024-01-01',
        '2024-06-30',
      );

      expect(result).toEqual(mockExport);
      expect(adminService.exportAnalytics).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-06-30',
      );
    });

    it('should use defaults when no date params provided', async () => {
      adminService.exportAnalytics.mockResolvedValue({
        generatedAt: new Date().toISOString(),
        dateRange: { from: '2023-06-15', to: '2024-06-15' },
        keyMetrics: {},
        timeSeries: {},
        categoryAnalytics: [],
      });

      await controller.exportAnalytics();

      expect(adminService.exportAnalytics).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('listPackagePurchases', () => {
    it('should return paginated purchases', async () => {
      const paginatedResult = {
        data: [{ _id: new Types.ObjectId(), sellerId: new Types.ObjectId() }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      adminService.listPackagePurchases.mockResolvedValue(paginatedResult);

      const result = await controller.listPackagePurchases({});

      expect(result).toEqual(paginatedResult);
      expect(adminService.listPackagePurchases).toHaveBeenCalledWith({});
    });

    it('should pass query filters to service', async () => {
      adminService.listPackagePurchases.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const query = { page: 2, limit: 10, status: 'completed' as any };
      await controller.listPackagePurchases(query);

      expect(adminService.listPackagePurchases).toHaveBeenCalledWith(query);
    });
  });

  describe('listPayments', () => {
    it('should return paginated payment transactions', async () => {
      const paginatedResult = {
        data: [{ _id: new Types.ObjectId(), paymentStatus: 'completed' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      adminService.listPayments.mockResolvedValue(paginatedResult);

      const result = await controller.listPayments({});

      expect(result).toEqual(paginatedResult);
      expect(adminService.listPayments).toHaveBeenCalledWith({});
    });
  });

  describe('getSellerAdInfo', () => {
    it('should return seller ad info', async () => {
      const sellerId = new Types.ObjectId().toString();
      const adInfo = {
        sellerId,
        activeAdCount: 7,
        adLimit: 10,
        remainingFreeSlots: 3,
        activePackageSlots: 15,
      };
      adminService.getSellerAdInfo.mockResolvedValue(adInfo);

      const result = await controller.getSellerAdInfo(sellerId);

      expect(result).toEqual(adInfo);
      expect(adminService.getSellerAdInfo).toHaveBeenCalledWith(sellerId);
    });
  });
});
