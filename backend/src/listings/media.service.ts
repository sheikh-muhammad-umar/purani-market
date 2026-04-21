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
import { StorageService, UploadResult } from './storage.service.js';
import { MediaType } from './dto/upload-media.dto.js';

export const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const ALLOWED_VIDEO_MIMETYPES = ['video/mp4'];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
export const MAX_IMAGES_PER_LISTING = 20;
export const MAX_VIDEOS_PER_LISTING = 1;

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
          'Invalid image format. Allowed: JPEG, PNG, WebP',
        );
      }
      if (file.size > MAX_IMAGE_SIZE) {
        throw new BadRequestException('Image size exceeds 5MB');
      }
    } else if (type === MediaType.VIDEO) {
      if (!ALLOWED_VIDEO_MIMETYPES.includes(file.mimetype)) {
        throw new BadRequestException('Invalid video format. Allowed: MP4');
      }
      if (file.size > MAX_VIDEO_SIZE) {
        throw new BadRequestException('Video size exceeds 50MB');
      }
    }
  }

  validateMediaLimits(listing: ProductListingDocument, type: MediaType): void {
    if (
      type === MediaType.IMAGE &&
      listing.images.length >= MAX_IMAGES_PER_LISTING
    ) {
      throw new BadRequestException(
        `Maximum ${MAX_IMAGES_PER_LISTING} images exceeded`,
      );
    }
    if (type === MediaType.VIDEO && listing.video) {
      throw new BadRequestException(
        `Maximum ${MAX_VIDEOS_PER_LISTING} video exceeded`,
      );
    }
  }

  private async processImageUpload(
    listing: ProductListingDocument,
    file: Express.Multer.File,
    sortOrder?: number,
  ): Promise<MediaUploadResult> {
    const compressed = await sharp(file.buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnail = await sharp(file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    const folder = `listings/${listing._id.toString()}`;
    const safeName = file.originalname.replace(/\.[^.]+$/, '.jpg');

    const imgResult = await this.storageService.saveFile(
      `${folder}/images`,
      safeName,
      compressed,
    );
    const thumbResult = await this.storageService.saveFile(
      `${folder}/thumbs`,
      `thumb-${safeName}`,
      thumbnail,
    );

    const order = sortOrder ?? listing.images.length;

    await this.listingModel.updateOne(
      { _id: listing._id },
      {
        $push: {
          images: {
            url: imgResult.fileUrl,
            thumbnailUrl: thumbResult.fileUrl,
            sortOrder: order,
          },
        },
      },
    );

    return {
      url: imgResult.fileUrl,
      thumbnailUrl: thumbResult.fileUrl,
      type: MediaType.IMAGE,
      sortOrder: order,
    };
  }

  private async processVideoUpload(
    listing: ProductListingDocument,
    file: Express.Multer.File,
  ): Promise<MediaUploadResult> {
    const folder = `listings/${listing._id.toString()}`;
    const result = await this.storageService.saveFile(
      `${folder}/videos`,
      file.originalname,
      file.buffer,
    );

    await this.listingModel.updateOne(
      { _id: listing._id },
      { $set: { video: { url: result.fileUrl } } },
    );

    return { url: result.fileUrl, type: MediaType.VIDEO };
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
      throw new ForbiddenException('Not authorized to upload to this listing');
    }
  }
}
