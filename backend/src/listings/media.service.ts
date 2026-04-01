import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import sharp from 'sharp';
import {
  ProductListing,
  ProductListingDocument,
} from './schemas/product-listing.schema.js';
import { StorageService } from './storage.service.js';
import { MediaType } from './dto/upload-media.dto.js';

export const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const ALLOWED_VIDEO_MIMETYPES = ['video/mp4'];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_IMAGES_PER_LISTING = 20;
export const MAX_VIDEOS_PER_LISTING = 1;
export const THUMBNAIL_WIDTH = 300;
export const THUMBNAIL_HEIGHT = 300;

export interface MediaUploadResult {
  url: string;
  thumbnailUrl?: string;
  type: MediaType;
  sortOrder?: number;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    private readonly storageService: StorageService,
  ) {}

  async uploadMedia(
    listingId: string,
    sellerId: string,
    file: Express.Multer.File,
    type: MediaType,
    sortOrder?: number,
  ): Promise<MediaUploadResult> {
    const listing = await this.getListingOrThrow(listingId);
    this.verifyOwnership(listing, sellerId);
    this.validateFile(file, type);
    this.validateMediaLimits(listing, type);

    if (type === MediaType.IMAGE) {
      return this.processImageUpload(listing, file, sortOrder);
    }
    return this.processVideoUpload(listing, file);
  }

  validateFile(file: Express.Multer.File, type: MediaType): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (type === MediaType.IMAGE) {
      if (!ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid image format. Allowed formats: JPEG, PNG, WebP`,
        );
      }
      if (file.size > MAX_IMAGE_SIZE) {
        throw new BadRequestException(
          `Image size exceeds maximum of 5MB`,
        );
      }
    } else if (type === MediaType.VIDEO) {
      if (!ALLOWED_VIDEO_MIMETYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid video format. Allowed format: MP4`,
        );
      }
      if (file.size > MAX_VIDEO_SIZE) {
        throw new BadRequestException(
          `Video size exceeds maximum of 50MB`,
        );
      }
    }
  }

  validateMediaLimits(listing: ProductListingDocument, type: MediaType): void {
    if (type === MediaType.IMAGE) {
      if (listing.images.length >= MAX_IMAGES_PER_LISTING) {
        throw new BadRequestException(
          `Maximum of ${MAX_IMAGES_PER_LISTING} images per listing exceeded`,
        );
      }
    } else if (type === MediaType.VIDEO) {
      if (listing.video) {
        throw new BadRequestException(
          `Maximum of ${MAX_VIDEOS_PER_LISTING} video per listing exceeded`,
        );
      }
    }
  }

  async compressImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  private async getListingOrThrow(
    listingId: string,
  ): Promise<ProductListingDocument> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new NotFoundException('Listing not found');
    }
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  private verifyOwnership(
    listing: ProductListingDocument,
    sellerId: string,
  ): void {
    if (listing.sellerId.toString() !== sellerId) {
      throw new ForbiddenException(
        'You do not have permission to upload media to this listing',
      );
    }
  }

  private async processImageUpload(
    listing: ProductListingDocument,
    file: Express.Multer.File,
    sortOrder?: number,
  ): Promise<MediaUploadResult> {
    const compressed = await this.compressImage(file.buffer);
    const thumbnail = await this.generateThumbnail(file.buffer);

    const imageUpload = await this.storageService.generatePresignedUploadUrl(
      `listings/${listing._id}/images`,
      file.originalname,
      'image/jpeg',
    );

    const thumbUpload = await this.storageService.generatePresignedUploadUrl(
      `listings/${listing._id}/thumbnails`,
      `thumb-${file.originalname}`,
      'image/jpeg',
    );

    const order = sortOrder ?? listing.images.length;

    await this.listingModel.updateOne(
      { _id: listing._id },
      {
        $push: {
          images: {
            url: imageUpload.fileUrl,
            thumbnailUrl: thumbUpload.fileUrl,
            sortOrder: order,
          },
        },
      },
    );

    return {
      url: imageUpload.fileUrl,
      thumbnailUrl: thumbUpload.fileUrl,
      type: MediaType.IMAGE,
      sortOrder: order,
    };
  }

  private async processVideoUpload(
    listing: ProductListingDocument,
    file: Express.Multer.File,
  ): Promise<MediaUploadResult> {
    const videoUpload = await this.storageService.generatePresignedUploadUrl(
      `listings/${listing._id}/videos`,
      file.originalname,
      'video/mp4',
    );

    await this.listingModel.updateOne(
      { _id: listing._id },
      {
        $set: {
          video: {
            url: videoUpload.fileUrl,
          },
        },
      },
    );

    return {
      url: videoUpload.fileUrl,
      type: MediaType.VIDEO,
    };
  }
}
