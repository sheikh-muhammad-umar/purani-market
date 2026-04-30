import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { PrerenderService } from './prerender.service';

describe('PrerenderService', () => {
  let service: PrerenderService;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      ttl: jest.fn().mockResolvedValue(-1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrerenderService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'cors.allowedOrigins') return 'http://localhost:4200';
              return undefined;
            }),
          },
        },
        {
          provide: getRedisConnectionToken(),
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<PrerenderService>(PrerenderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('STATIC_PAGES', () => {
    it('should contain all required static page paths', () => {
      const expectedPages = [
        '/pages/about',
        '/pages/terms',
        '/pages/privacy',
        '/pages/contact',
        '/pages/careers',
        '/pages/press',
        '/pages/trust-safety',
        '/pages/selling-tips',
        '/pages/cookies',
      ];

      expect(PrerenderService.STATIC_PAGES).toEqual(expectedPages);
    });

    it('should define HOME_PAGE as /', () => {
      expect(PrerenderService.HOME_PAGE).toBe('/');
    });
  });

  describe('refreshRoute', () => {
    it('should fetch the route and cache the HTML in Redis', async () => {
      const mockHtml = '<html><body>Home</body></html>';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockHtml),
      });

      await service.refreshRoute('/', 3600);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4200/',
        expect.objectContaining({
          headers: {
            'User-Agent': 'MarketplacePrerenderBot/1.0',
            Accept: 'text/html',
          },
        }),
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'prerender:/',
        3600,
        mockHtml,
      );
    });

    it('should not cache HTML when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await service.refreshRoute('/pages/about', 86400);

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(service.refreshRoute('/', 3600)).resolves.toBeUndefined();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('getCachedHtml', () => {
    it('should return cached HTML from Redis', async () => {
      const cachedHtml = '<html><body>Cached</body></html>';
      mockRedis.get.mockResolvedValue(cachedHtml);

      const result = await service.getCachedHtml('/');
      expect(result).toBe(cachedHtml);
      expect(mockRedis.get).toHaveBeenCalledWith('prerender:/');
    });

    it('should return null when no cache exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getCachedHtml('/pages/about');
      expect(result).toBeNull();
    });

    it('should return null on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));

      const result = await service.getCachedHtml('/');
      expect(result).toBeNull();
    });
  });

  describe('getWithStaleWhileRevalidate', () => {
    it('should return cached HTML when TTL is healthy', async () => {
      const cachedHtml = '<html><body>Fresh</body></html>';
      mockRedis.get.mockResolvedValue(cachedHtml);
      mockRedis.ttl.mockResolvedValue(3000); // Well above 10% of 3600

      const result = await service.getWithStaleWhileRevalidate('/');
      expect(result).toBe(cachedHtml);
    });

    it('should return null when no cached HTML exists', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.ttl.mockResolvedValue(-2);

      const result = await service.getWithStaleWhileRevalidate('/');
      expect(result).toBeNull();
    });

    it('should trigger background refresh when TTL is below 10% threshold for home page', async () => {
      const staleHtml = '<html><body>Stale</body></html>';
      mockRedis.get.mockResolvedValue(staleHtml);
      mockRedis.ttl.mockResolvedValue(100); // Below 10% of 3600 (360)

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('<html>Fresh</html>'),
      });

      const result = await service.getWithStaleWhileRevalidate('/');

      // Should still return the stale HTML immediately
      expect(result).toBe(staleHtml);

      // Wait for the background refresh to fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Background refresh should have been triggered
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should trigger background refresh when TTL is below 10% threshold for static pages', async () => {
      const staleHtml = '<html><body>Stale About</body></html>';
      mockRedis.get.mockResolvedValue(staleHtml);
      mockRedis.ttl.mockResolvedValue(1000); // Below 10% of 86400 (8640)

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('<html>Fresh</html>'),
      });

      const result = await service.getWithStaleWhileRevalidate('/pages/about');

      expect(result).toBe(staleHtml);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));

      const result = await service.getWithStaleWhileRevalidate('/');
      expect(result).toBeNull();
    });
  });

  describe('refreshHomePage', () => {
    it('should call refreshRoute with home page path and 1 hour TTL', async () => {
      const refreshSpy = jest
        .spyOn(service, 'refreshRoute')
        .mockResolvedValue(undefined);

      await service.refreshHomePage();

      expect(refreshSpy).toHaveBeenCalledWith('/', 3600);
    });
  });

  describe('refreshStaticPages', () => {
    it('should call refreshRoute for each static page with 24 hour TTL', async () => {
      const refreshSpy = jest
        .spyOn(service, 'refreshRoute')
        .mockResolvedValue(undefined);

      await service.refreshStaticPages();

      expect(refreshSpy).toHaveBeenCalledTimes(
        PrerenderService.STATIC_PAGES.length,
      );

      for (const page of PrerenderService.STATIC_PAGES) {
        expect(refreshSpy).toHaveBeenCalledWith(page, 86400);
      }
    });

    it('should handle partial failures gracefully', async () => {
      let callCount = 0;
      jest.spyOn(service, 'refreshRoute').mockImplementation(async () => {
        callCount++;
        if (callCount === 3) throw new Error('Network error');
      });

      // Should not throw even if some routes fail
      await expect(service.refreshStaticPages()).resolves.toBeUndefined();
    });
  });
});
