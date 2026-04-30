import { Test, TestingModule } from '@nestjs/testing';
import { RobotsController } from './robots.controller.js';

describe('RobotsController', () => {
  let controller: RobotsController;
  let robotsTxt: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RobotsController],
    }).compile();

    controller = module.get<RobotsController>(RobotsController);
    robotsTxt = controller.getRobotsTxt();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRobotsTxt', () => {
    it('should return a non-empty string', () => {
      expect(typeof robotsTxt).toBe('string');
      expect(robotsTxt.length).toBeGreaterThan(0);
    });

    // --- Allow directives (Requirement 7.2) ---

    describe('Allow directives', () => {
      const allowedPaths = [
        '/',
        '/listings/',
        '/categories/',
        '/seller/',
        '/search',
        '/pages/',
      ];

      it.each(allowedPaths)('should contain Allow directive for %s', (path) => {
        expect(robotsTxt).toContain(`Allow: ${path}`);
      });
    });

    // --- Disallow directives (Requirement 7.3) ---

    describe('Disallow directives', () => {
      const disallowedPaths = [
        '/profile',
        '/favorites',
        '/messaging',
        '/admin',
        '/auth',
        '/listings/create',
        '/listings/my',
        '/listings/*/edit',
      ];

      it.each(disallowedPaths)(
        'should contain Disallow directive for %s',
        (path) => {
          expect(robotsTxt).toContain(`Disallow: ${path}`);
        },
      );
    });

    // --- Sitemap directive (Requirement 7.4) ---

    it('should contain Sitemap directive pointing to correct URL', () => {
      expect(robotsTxt).toContain(
        'Sitemap: https://marketplace.pk/sitemap.xml',
      );
    });

    // --- Crawl-delay directive (Requirement 7.5) ---

    it('should contain Crawl-delay set to 1', () => {
      expect(robotsTxt).toContain('Crawl-delay: 1');
    });

    // --- User-agent directive (Requirement 7.1) ---

    it('should contain User-agent: * directive', () => {
      expect(robotsTxt).toContain('User-agent: *');
    });
  });
});
