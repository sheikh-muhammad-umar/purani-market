"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = exports.MAX_VIDEOS_PER_LISTING = exports.MAX_IMAGES_PER_LISTING = exports.MAX_VIDEO_SIZE = exports.MAX_IMAGE_SIZE = exports.ALLOWED_VIDEO_MIMETYPES = exports.ALLOWED_IMAGE_MIMETYPES = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const sharp_1 = __importDefault(require("sharp"));
const product_listing_schema_js_1 = require("./schemas/product-listing.schema.js");
const storage_service_js_1 = require("./storage.service.js");
const upload_media_dto_js_1 = require("./dto/upload-media.dto.js");
exports.ALLOWED_IMAGE_MIMETYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
];
exports.ALLOWED_VIDEO_MIMETYPES = ['video/mp4'];
exports.MAX_IMAGE_SIZE = 5 * 1024 * 1024;
exports.MAX_VIDEO_SIZE = 50 * 1024 * 1024;
exports.MAX_IMAGES_PER_LISTING = 20;
exports.MAX_VIDEOS_PER_LISTING = 1;
let MediaService = class MediaService {
    listingModel;
    storageService;
    constructor(listingModel, storageService) {
        this.listingModel = listingModel;
        this.storageService = storageService;
    }
    async uploadMedia(listingId, sellerId, file, type, sortOrder) {
        const listing = await this.getListingOrThrow(listingId);
        this.verifyOwnership(listing, sellerId);
        this.validateFile(file, type);
        this.validateMediaLimits(listing, type);
        if (type === upload_media_dto_js_1.MediaType.IMAGE) {
            return this.processImageUpload(listing, file, sortOrder);
        }
        return this.processVideoUpload(listing, file);
    }
    validateFile(file, type) {
        if (!file) {
            throw new common_1.BadRequestException('No file provided');
        }
        if (type === upload_media_dto_js_1.MediaType.IMAGE) {
            if (!exports.ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
                throw new common_1.BadRequestException('Invalid image format. Allowed: JPEG, PNG, WebP');
            }
            if (file.size > exports.MAX_IMAGE_SIZE) {
                throw new common_1.BadRequestException('Image size exceeds 5MB');
            }
        }
        else if (type === upload_media_dto_js_1.MediaType.VIDEO) {
            if (!exports.ALLOWED_VIDEO_MIMETYPES.includes(file.mimetype)) {
                throw new common_1.BadRequestException('Invalid video format. Allowed: MP4');
            }
            if (file.size > exports.MAX_VIDEO_SIZE) {
                throw new common_1.BadRequestException('Video size exceeds 50MB');
            }
        }
    }
    validateMediaLimits(listing, type) {
        if (type === upload_media_dto_js_1.MediaType.IMAGE &&
            listing.images.length >= exports.MAX_IMAGES_PER_LISTING) {
            throw new common_1.BadRequestException(`Maximum ${exports.MAX_IMAGES_PER_LISTING} images exceeded`);
        }
        if (type === upload_media_dto_js_1.MediaType.VIDEO && listing.video) {
            throw new common_1.BadRequestException(`Maximum ${exports.MAX_VIDEOS_PER_LISTING} video exceeded`);
        }
    }
    async processImageUpload(listing, file, sortOrder) {
        const compressed = await (0, sharp_1.default)(file.buffer)
            .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
        const thumbnail = await (0, sharp_1.default)(file.buffer)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 70 })
            .toBuffer();
        const folder = `listings/${listing._id.toString()}`;
        const safeName = file.originalname.replace(/\.[^.]+$/, '.jpg');
        const imgResult = await this.storageService.saveFile(`${folder}/images`, safeName, compressed);
        const thumbResult = await this.storageService.saveFile(`${folder}/thumbs`, `thumb-${safeName}`, thumbnail);
        const order = sortOrder ?? listing.images.length;
        await this.listingModel.updateOne({ _id: listing._id }, {
            $push: {
                images: {
                    url: imgResult.fileUrl,
                    thumbnailUrl: thumbResult.fileUrl,
                    sortOrder: order,
                },
            },
        });
        return {
            url: imgResult.fileUrl,
            thumbnailUrl: thumbResult.fileUrl,
            type: upload_media_dto_js_1.MediaType.IMAGE,
            sortOrder: order,
        };
    }
    async processVideoUpload(listing, file) {
        const folder = `listings/${listing._id.toString()}`;
        const result = await this.storageService.saveFile(`${folder}/videos`, file.originalname, file.buffer);
        await this.listingModel.updateOne({ _id: listing._id }, { $set: { video: { url: result.fileUrl } } });
        return { url: result.fileUrl, type: upload_media_dto_js_1.MediaType.VIDEO };
    }
    async getListingOrThrow(listingId) {
        if (!mongoose_2.Types.ObjectId.isValid(listingId)) {
            throw new common_1.NotFoundException('Listing not found');
        }
        const listing = await this.listingModel.findById(listingId).exec();
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        return listing;
    }
    verifyOwnership(listing, sellerId) {
        if (listing.sellerId.toString() !== sellerId) {
            throw new common_1.ForbiddenException('Not authorized to upload to this listing');
        }
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        storage_service_js_1.StorageService])
], MediaService);
//# sourceMappingURL=media.service.js.map