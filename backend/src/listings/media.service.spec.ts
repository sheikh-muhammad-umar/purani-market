import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  MediaService,
  ALLOWED_IMAGE_MIMETYPES,
  ALLOWED_VIDEO_MIMETYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_IMAGES_PER_LISTING,
} from './media.service';
import { StorageService } from './storage.service';
import { ProductListing } from './schemas/product-listing.schema';
import { MediaType } from './dto/upload-media.dto';

// Mock sharp
jest.mock('sharp', () => {
  const mockSharp = jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('compressed')),
  }));
  return { __esModule: true, default: mockSharp };
});

describe('MediaService', () => {
  let service: MediaService;
  let mockListingModel: any;
  let mockStorageService: Partial<Record<keyof StorageService, jest.Mock>>;

  const listingId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();

  const mockListing = {
    _id: listingId,
    sellerId,
    images: [
      { url: 'https://storage.example.com/img1.jpg', thumbnailUrl: 'https://storage.example.com/thumb1.jpg', sortOrder: 0 },
    ],
    video: undefined,
  };

  const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 1024, // 1MB
    buffer: Buffer.from('fake-image-data'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    ...overrides,
  });

  beforeEach(async () => {
    mockListingModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockListing }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    mockStorageService = {
      generatePresignedUploadUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://storage.example.com/upload?token=mock',
        fileUrl: 'https://storage.example.com/file.jpg',
        key: 'listings/123/images/file.jpg',
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: getModelToken(ProductListing.name), useValue: mockListingModel },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  describe('validateFile', () => {
    it('should accept valid JPEG image', () => {
      const file = createMockFile({ mimetype: 'image/jpeg', size: 1024 * 1024 });
      expect(() => service.validateFile(file, MediaType.IMAGE)).not.toThrow();
    });

    it('should accept valid PNG image', () => {
      const file = createMockFile({ mimetype: 'image/png', size: 2 * 1024 * 1024 });
      expect(() => service.validateFile(file, MediaType.IMAGE)).not.toThrow();
    });

    it('should accept valid WebP image', () => {
      const file = createMockFile({ mimetype: 'image/webp', size: 1024 * 1024 });
      expect(() => service.validateFile(file, MediaType.IMAGE)).not.toThrow();
    });

    it('should reject invalid image format (GIF)', () => {
      const file = createMockFile({ mimetype: 'image/gif', size: 1024 * 1024 });
      expect(() => service.validateFile(file, MediaType.IMAGE)).toThrow(BadRequestException);
    });

    it('should reject image exceeding 5MB', () => {
      const file = createMockFile({ mimetype: 'image/jpeg', size: MAX_IMAGE_SIZE + 1 });
      expect(() => service.validateFile(file, MediaType.IMAGE)).toThrow(BadRequestException);
    });

    it('should accept image exactly at 5MB', () => {
      const file = createMockFile({ mimetype: 'image/jpeg', size: MAX_IMAGE_SIZE });
      expect(() => service.validateFile(file, MediaType.IMAGE)).not.toThrow();
    });

    it('should accept valid MP4 video', () => {
      const file = createMockFile({ mimetype: 'video/mp4', size: 10 * 1024 * 1024 });
      expect(() => service.validateFile(file, MediaType.VIDEO)).not.toThrow();
    });

    it('should reject invalid video format (AVI)', () => {
      const file = createMockFile({ mimetype: 'video/avi', size: 10 * 1024 * 1024 });
      expect(() => service.validateFile(file, MediaType.VIDEO)).toThrow(BadRequestException);
    });

    it('should reject video exceeding 50MB', () => {
      const file = createMockFile({ mimetype: 'video/mp4', size: MAX_VIDEO_SIZE + 1 });
      expect(() => service.validateFile(file, MediaType.VIDEO)).toThrow(BadRequestException);
    });

    it('should accept video exactly at 50MB', () => {
      const file = createMockFile({ mimetype: 'video/mp4', size: MAX_VIDEO_SIZE });
      expect(() => service.validateFile(file, MediaType.VIDEO)).not.toThrow();
    });

    it('should throw when no file is provided', () => {
      expect(() => service.validateFile(null as any, MediaType.IMAGE)).toThrow(BadRequestException);
    });
  });

  describe('validateMediaLimits', () => {
    it('should allow image upload when under limit', () => {
      const listing = { images: [], video: undefined } as any;
      expect(() => service.validateMediaLimits(listing, MediaType.IMAGE)).not.toThrow();
    });

    it('should reject image upload when at max (20 images)', () => {
      const images = Array.from({ length: MAX_IMAGES_PER_LISTING }, (_, i) => ({
        url: `https://example.com/img${i}.jpg`,
        sortOrder: i,
      }));
      const listing = { images, video: undefined } as any;
      expect(() => service.validateMediaLimits(listing, MediaType.IMAGE)).toThrow(
        BadRequestException,
      );
    });

    it('should allow video upload when no video exists', () => {
      const listing = { images: [], video: undefined } as any;
      expect(() => service.validateMediaLimits(listing, MediaType.VIDEO)).not.toThrow();
    });

    it('should reject video upload when listing already has a video', () => {
      const listing = { images: [], video: { url: 'https://example.com/video.mp4' } } as any;
      expect(() => service.validateMediaLimits(listing, MediaType.VIDEO)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('compressImage', () => {
    it('should return a compressed buffer', async () => {
      const result = await service.compressImage(Buffer.from('test'));
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('generateThumbnail', () => {
    it('should return a thumbnail buffer', async () => {
      const result = await service.generateThumbnail(Buffer.from('test'));
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('uploadMedia', () => {
    it('should throw NotFoundException for invalid listing ID', async () => {
      const file = createMockFile();
      await expect(
        service.uploadMedia('invalid-id', sellerId.toString(), file, MediaType.IMAGE),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when listing does not exist', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const file = createMockFile();
      await expect(
        service.uploadMedia(new Types.ObjectId().toString(), sellerId.toString(), file, MediaType.IMAGE),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when seller does not own listing', async () => {
      const otherSellerId = new Types.ObjectId();
      const file = createMockFile();
      await expect(
        service.uploadMedia(listingId.toString(), otherSellerId.toString(), file, MediaType.IMAGE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should upload an image successfully', async () => {
      const file = createMockFile();
      const result = await service.uploadMedia(
        listingId.toString(),
        sellerId.toString(),
        file,
        MediaType.IMAGE,
      );

      expect(result.type).toBe(MediaType.IMAGE);
      expect(result.url).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
      expect(mockStorageService.generatePresignedUploadUrl).toHaveBeenCalledTimes(2);
      expect(mockListingModel.updateOne).toHaveBeenCalled();
    });

    it('should upload a video successfully', async () => {
      const file = createMockFile({ mimetype: 'video/mp4', size: 10 * 1024 * 1024 });
      const result = await service.uploadMedia(
        listingId.toString(),
        sellerId.toString(),
        file,
        MediaType.VIDEO,
      );

      expect(result.type).toBe(MediaType.VIDEO);
      expect(result.url).toBeDefined();
      expect(result.thumbnailUrl).toBeUndefined();
      expect(mockStorageService.generatePresignedUploadUrl).toHaveBeenCalledTimes(1);
      expect(mockListingModel.updateOne).toHaveBeenCalled();
    });

    it('should use provided sortOrder for images', async () => {
      const file = createMockFile();
      const result = await service.uploadMedia(
        listingId.toString(),
        sellerId.toString(),
        file,
        MediaType.IMAGE,
        5,
      );

      expect(result.sortOrder).toBe(5);
    });

    it('should default sortOrder to current image count', async () => {
      const file = createMockFile();
      const result = await service.uploadMedia(
        listingId.toString(),
        sellerId.toString(),
        file,
        MediaType.IMAGE,
      );

      // mockListing has 1 image, so sortOrder should be 1
      expect(result.sortOrder).toBe(1);
    });
  });
});
