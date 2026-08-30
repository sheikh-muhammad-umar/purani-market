import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { IdVerificationService } from './id-verification.service';
import {
  IdVerification,
  IdVerificationStatus,
} from './schemas/id-verification.schema';
import { User } from '../users/schemas/user.schema';
import { StorageService } from '../listings/storage.service';
import { ListingsService } from '../listings/listings.service';

describe('IdVerificationService', () => {
  let service: IdVerificationService;
  let verificationModel: any;
  let userModel: any;
  let listingsService: { syncSellerVerified: jest.Mock };
  let storageService: { saveFile: jest.Mock };

  const verificationId = new Types.ObjectId();
  const adminId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  /** A pending submission waiting on a decision. */
  const pendingRecord = (): Record<string, any> => ({
    _id: verificationId,
    userId,
    status: IdVerificationStatus.PENDING,
    save: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(async () => {
    verificationModel = {
      findById: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      }),
    };
    userModel = {
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ idVerified: false }),
      }),
    };
    listingsService = { syncSellerVerified: jest.fn().mockResolvedValue(0) };
    storageService = {
      saveFile: jest.fn().mockResolvedValue({ url: 'u', thumbnailUrl: 't' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdVerificationService,
        {
          provide: getModelToken(IdVerification.name),
          useValue: verificationModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: StorageService, useValue: storageService },
        { provide: ListingsService, useValue: listingsService },
      ],
    }).compile();

    service = module.get<IdVerificationService>(IdVerificationService);
  });

  describe('reviewVerification', () => {
    it('should mark the user verified and refresh their listing badges on approval', async () => {
      const record = pendingRecord();
      verificationModel.findById.mockResolvedValue(record);

      await service.reviewVerification(
        verificationId.toString(),
        adminId.toString(),
        IdVerificationStatus.APPROVED,
      );

      expect(record.status).toBe(IdVerificationStatus.APPROVED);
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $set: { idVerified: true },
      });
      expect(listingsService.syncSellerVerified).toHaveBeenCalledWith(
        userId.toString(),
      );
    });

    /**
     * The bug this guards: rejection used to leave `idVerified` untouched, so the
     * flag was write-once and the "Verified seller" badge on the seller's existing
     * listings kept asserting the old approval.
     */
    it('should withdraw verification and refresh badges on rejection', async () => {
      const record = pendingRecord();
      verificationModel.findById.mockResolvedValue(record);

      await service.reviewVerification(
        verificationId.toString(),
        adminId.toString(),
        IdVerificationStatus.REJECTED,
        'Document unreadable',
      );

      expect(record.status).toBe(IdVerificationStatus.REJECTED);
      expect(record.rejectionReason).toBe('Document unreadable');
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $set: { idVerified: false },
      });
      expect(listingsService.syncSellerVerified).toHaveBeenCalledWith(
        userId.toString(),
      );
    });

    it('should refuse to review a record that is not pending', async () => {
      verificationModel.findById.mockResolvedValue({
        ...pendingRecord(),
        status: IdVerificationStatus.APPROVED,
      });

      await expect(
        service.reviewVerification(
          verificationId.toString(),
          adminId.toString(),
          IdVerificationStatus.REJECTED,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(listingsService.syncSellerVerified).not.toHaveBeenCalled();
    });

    it('should reject PENDING as a review outcome', async () => {
      await expect(
        service.reviewVerification(
          verificationId.toString(),
          adminId.toString(),
          IdVerificationStatus.PENDING,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
  describe('submitVerification attempt limit', () => {
    /** Four distinct buffers, so the duplicate-image guard is not what trips. */
    const files = () =>
      ({
        cnicFront: { buffer: Buffer.from('a'), originalname: 'a.jpg' },
        cnicBack: { buffer: Buffer.from('b'), originalname: 'b.jpg' },
        selfieFront: { buffer: Buffer.from('c'), originalname: 'c.jpg' },
        selfieBack: { buffer: Buffer.from('d'), originalname: 'd.jpg' },
      }) as any;

    const usedAttempts = (n: number) =>
      verificationModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(n),
      });

    it('should refuse a fourth submission once three were rejected', async () => {
      usedAttempts(3);

      await expect(
        service.submitVerification(userId.toString(), files()),
      ).rejects.toThrow(BadRequestException);

      // Counted before any upload, so an exhausted user cannot fill storage.
      expect(storageService.saveFile).not.toHaveBeenCalled();
    });

    it('should count only admin rejections, exempting auto-expired submissions', async () => {
      usedAttempts(0);

      await service
        .submitVerification(userId.toString(), files())
        .catch(() => undefined);

      // The auto-expire cron sets a status and reason but never a reviewer, so
      // requiring reviewedBy is what keeps an unreviewed submission free.
      expect(verificationModel.countDocuments).toHaveBeenCalledWith({
        userId: expect.anything(),
        status: IdVerificationStatus.REJECTED,
        reviewedBy: { $exists: true },
      });
    });

    it('should still allow the third submission', async () => {
      usedAttempts(2);

      await service
        .submitVerification(userId.toString(), files())
        .catch(() => undefined);

      // Got past the limit check and on to doing the work.
      expect(storageService.saveFile).toHaveBeenCalled();
    });

    it('should refuse a submission from an already verified user', async () => {
      usedAttempts(0);
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ idVerified: true }),
      });

      await expect(
        service.submitVerification(userId.toString(), files()),
      ).rejects.toThrow(BadRequestException);
      expect(storageService.saveFile).not.toHaveBeenCalled();
    });

    it('should refuse a submission while one is still pending', async () => {
      usedAttempts(0);
      verificationModel.findOne.mockResolvedValue({ _id: verificationId });

      await expect(
        service.submitVerification(userId.toString(), files()),
      ).rejects.toThrow(BadRequestException);
      expect(storageService.saveFile).not.toHaveBeenCalled();
    });
  });

  describe('getMyVerification', () => {
    it('should report attempts remaining alongside the latest submission', async () => {
      verificationModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue({ _id: verificationId, status: 'rejected' }),
          }),
        }),
      });
      verificationModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      const result = await service.getMyVerification(userId.toString());

      expect(result).toMatchObject({
        attemptsUsed: 2,
        attemptsRemaining: 1,
        maxAttempts: 3,
      });
    });

    it('should never report negative attempts remaining', async () => {
      verificationModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: verificationId }),
          }),
        }),
      });
      verificationModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });

      const result = await service.getMyVerification(userId.toString());

      expect(result?.attemptsRemaining).toBe(0);
    });
  });
});
