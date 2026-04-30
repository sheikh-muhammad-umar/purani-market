import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SitemapController } from './sitemap.controller.js';
import { SitemapService } from './sitemap.service.js';
import { SitemapUrl } from './dto/sitemap-url.dto.js';

describe('SitemapController', () => {
  let controller: SitemapController;
  let sitemapService: Record<string, jest.Mock>;

  const sampleSitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>https://marketplace.pk/</loc>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
  ].join('\n');

  const minimalSitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>https://marketplace.pk/</loc>',
    '    <priority>1.0</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://marketplace.pk/pages/about</loc>',
    '    <priority>0.3</priority>',
    '  </url>',
    '</urlset>',
  ].join('\n');

  beforeEach(async () => {
    sitemapService = {
      getCachedSitemap: jest.fn(),
      getCachedSitemapPart: jest.fn(),
      generateSitemap: jest.fn(),
      buildStaticUrls: jest.fn(),
      generateSitemapXml: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SitemapController],
      providers: [{ provide: SitemapService, useValue: sitemapService }],
    }).compile();

    controller = module.get<SitemapController>(SitemapController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- GET /sitemap.xml ---

  describe('getSitemap', () => {
    it('should return cached sitemap when available', async () => {
      sitemapService.getCachedSitemap.mockResolvedValue(sampleSitemapXml);

      const result = await controller.getSitemap();

      expect(sitemapService.getCachedSitemap).toHaveBeenCalled();
      expect(sitemapService.generateSitemap).not.toHaveBeenCalled();
      expect(result).toBe(sampleSitemapXml);
    });

    it('should trigger generation when no cached sitemap exists', async () => {
      sitemapService.getCachedSitemap.mockResolvedValue(null);
      sitemapService.generateSitemap.mockResolvedValue(sampleSitemapXml);

      const result = await controller.getSitemap();

      expect(sitemapService.getCachedSitemap).toHaveBeenCalled();
      expect(sitemapService.generateSitemap).toHaveBeenCalled();
      expect(result).toBe(sampleSitemapXml);
    });

    it('should return cached sitemap on generation failure', async () => {
      sitemapService.getCachedSitemap
        .mockRejectedValueOnce(new Error('Redis down'))
        .mockResolvedValueOnce(sampleSitemapXml);

      const result = await controller.getSitemap();

      expect(result).toBe(sampleSitemapXml);
    });

    it('should return minimal sitemap when both cache and generation fail', async () => {
      const staticUrls: SitemapUrl[] = [];
      const homeUrl = new SitemapUrl();
      homeUrl.loc = 'https://marketplace.pk/';
      homeUrl.priority = 1.0;
      staticUrls.push(homeUrl);

      sitemapService.getCachedSitemap
        .mockRejectedValueOnce(new Error('Redis down'))
        .mockRejectedValueOnce(new Error('Redis still down'));
      sitemapService.buildStaticUrls.mockReturnValue(staticUrls);
      sitemapService.generateSitemapXml.mockReturnValue(minimalSitemapXml);

      const result = await controller.getSitemap();

      expect(sitemapService.buildStaticUrls).toHaveBeenCalled();
      expect(sitemapService.generateSitemapXml).toHaveBeenCalledWith(
        staticUrls,
      );
      expect(result).toBe(minimalSitemapXml);
    });
  });

  // --- GET /sitemap-:index.xml ---

  describe('getSitemapPart', () => {
    it('should return cached sitemap part when available', async () => {
      sitemapService.getCachedSitemapPart.mockResolvedValue(sampleSitemapXml);

      const result = await controller.getSitemapPart('1');

      expect(sitemapService.getCachedSitemapPart).toHaveBeenCalledWith(1);
      expect(sitemapService.generateSitemap).not.toHaveBeenCalled();
      expect(result).toBe(sampleSitemapXml);
    });

    it('should trigger generation when part is not cached, then return it', async () => {
      sitemapService.getCachedSitemapPart
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sampleSitemapXml);
      sitemapService.generateSitemap.mockResolvedValue('index xml');

      const result = await controller.getSitemapPart('2');

      expect(sitemapService.getCachedSitemapPart).toHaveBeenCalledWith(2);
      expect(sitemapService.generateSitemap).toHaveBeenCalled();
      expect(result).toBe(sampleSitemapXml);
    });

    it('should throw NotFoundException when part does not exist after generation', async () => {
      sitemapService.getCachedSitemapPart
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      sitemapService.generateSitemap.mockResolvedValue('index xml');

      await expect(controller.getSitemapPart('99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-numeric index', async () => {
      await expect(controller.getSitemapPart('abc')).rejects.toThrow(
        NotFoundException,
      );
      expect(sitemapService.getCachedSitemapPart).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for zero index', async () => {
      await expect(controller.getSitemapPart('0')).rejects.toThrow(
        NotFoundException,
      );
      expect(sitemapService.getCachedSitemapPart).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for negative index', async () => {
      await expect(controller.getSitemapPart('-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(sitemapService.getCachedSitemapPart).not.toHaveBeenCalled();
    });

    it('should return cached part as fallback on generation error', async () => {
      sitemapService.getCachedSitemapPart
        .mockRejectedValueOnce(new Error('Redis error'))
        .mockResolvedValueOnce(sampleSitemapXml);

      const result = await controller.getSitemapPart('1');

      expect(result).toBe(sampleSitemapXml);
    });

    it('should throw NotFoundException when all fallbacks fail', async () => {
      sitemapService.getCachedSitemapPart
        .mockRejectedValueOnce(new Error('Redis error'))
        .mockRejectedValueOnce(new Error('Redis still down'));

      await expect(controller.getSitemapPart('1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
