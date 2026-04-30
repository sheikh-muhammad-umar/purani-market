import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SeoController } from './seo.controller.js';
import { SeoService } from './seo.service.js';
import { ListingSeoDto } from './dto/listing-seo.dto.js';
import { SellerSeoDto } from './dto/seller-seo.dto.js';
import { HomeSeoDto } from './dto/home-seo.dto.js';

describe('SeoController', () => {
  let controller: SeoController;
  let seoService: Record<string, jest.Mock>;

  beforeEach(async () => {
    seoService = {
      getListingSeo: jest.fn(),
      getSellerSeo: jest.fn(),
      getHomeSeo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeoController],
      providers: [{ provide: SeoService, useValue: seoService }],
    }).compile();

    controller = module.get<SeoController>(SeoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- GET /api/seo/listing/:id ---

  describe('getListingSeo', () => {
    const validId = new Types.ObjectId().toString();

    it('should call SeoService.getListingSeo with the correct id', async () => {
      const dto = new ListingSeoDto();
      dto.title = 'Test Listing - PKR 5000 | marketplace.pk';
      seoService.getListingSeo.mockResolvedValue(dto);

      const result = await controller.getListingSeo(validId);

      expect(seoService.getListingSeo).toHaveBeenCalledWith(validId);
      expect(result).toBe(dto);
    });

    it('should propagate NotFoundException as 404 when listing not found', async () => {
      seoService.getListingSeo.mockRejectedValue(
        new NotFoundException('Listing not found'),
      );

      await expect(controller.getListingSeo(validId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for malformed ObjectId', async () => {
      await expect(controller.getListingSeo('not-a-valid-id')).rejects.toThrow(
        BadRequestException,
      );
      expect(seoService.getListingSeo).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty string id', async () => {
      await expect(controller.getListingSeo('')).rejects.toThrow(
        BadRequestException,
      );
      expect(seoService.getListingSeo).not.toHaveBeenCalled();
    });
  });

  // --- GET /api/seo/seller/:id ---

  describe('getSellerSeo', () => {
    const validId = new Types.ObjectId().toString();

    it('should call SeoService.getSellerSeo with the correct id', async () => {
      const dto = new SellerSeoDto();
      dto.title = 'John Doe - Seller Profile | marketplace.pk';
      seoService.getSellerSeo.mockResolvedValue(dto);

      const result = await controller.getSellerSeo(validId);

      expect(seoService.getSellerSeo).toHaveBeenCalledWith(validId);
      expect(result).toBe(dto);
    });

    it('should propagate NotFoundException as 404 when seller not found', async () => {
      seoService.getSellerSeo.mockRejectedValue(
        new NotFoundException('Seller not found'),
      );

      await expect(controller.getSellerSeo(validId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for malformed ObjectId', async () => {
      await expect(controller.getSellerSeo('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
      expect(seoService.getSellerSeo).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for short numeric string', async () => {
      await expect(controller.getSellerSeo('12345')).rejects.toThrow(
        BadRequestException,
      );
      expect(seoService.getSellerSeo).not.toHaveBeenCalled();
    });
  });

  // --- GET /api/seo/home ---

  describe('getHomeSeo', () => {
    it('should call SeoService.getHomeSeo with no parameters', async () => {
      const dto = new HomeSeoDto();
      dto.title = 'marketplace.pk - Buy & Sell in Pakistan';
      dto.featuredCategories = ['Electronics', 'Vehicles'];
      seoService.getHomeSeo.mockResolvedValue(dto);

      const result = await controller.getHomeSeo();

      expect(seoService.getHomeSeo).toHaveBeenCalledWith();
      expect(result).toBe(dto);
    });

    it('should return the DTO from SeoService unchanged', async () => {
      const dto = new HomeSeoDto();
      dto.title = 'marketplace.pk - Buy & Sell in Pakistan';
      dto.description = 'Buy and sell new and used products in Pakistan.';
      dto.featuredCategories = ['Electronics', 'Vehicles', 'Property'];
      dto.canonicalUrl = 'https://marketplace.pk';
      dto.websiteJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
      };
      seoService.getHomeSeo.mockResolvedValue(dto);

      const result = await controller.getHomeSeo();

      expect(result).toEqual(dto);
    });
  });
});
