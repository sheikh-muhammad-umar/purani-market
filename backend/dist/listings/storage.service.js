"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let StorageService = class StorageService {
    bucketName = 'marketplace-media';
    baseUrl = 'https://storage.example.com';
    async generatePresignedUploadUrl(folder, filename, contentType) {
        const key = `${folder}/${(0, crypto_1.randomUUID)()}-${filename}`;
        return {
            uploadUrl: `${this.baseUrl}/${this.bucketName}/${key}?X-Upload-Token=mock-presigned-token`,
            fileUrl: `${this.baseUrl}/${this.bucketName}/${key}`,
            key,
        };
    }
    async deleteFile(key) {
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)()
], StorageService);
//# sourceMappingURL=storage.service.js.map