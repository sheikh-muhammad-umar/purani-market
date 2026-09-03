import { Test, TestingModule } from '@nestjs/testing';
import { ExperimentsController } from './experiments.controller.js';
import { ExperimentsService } from './experiments.service.js';
import { ExperimentEventType } from './schemas/experiment-event.schema.js';

describe('ExperimentsController', () => {
  let controller: ExperimentsController;
  let service: {
    getAssignments: jest.Mock;
    trackEvent: jest.Mock;
    listAll: jest.Mock;
    create: jest.Mock;
    start: jest.Mock;
    pause: jest.Mock;
    complete: jest.Mock;
    getMetrics: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getAssignments: jest.fn().mockResolvedValue([]),
      trackEvent: jest.fn().mockResolvedValue(undefined),
      listAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      start: jest.fn().mockResolvedValue({}),
      pause: jest.fn().mockResolvedValue({}),
      complete: jest.fn().mockResolvedValue({}),
      getMetrics: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [{ provide: ExperimentsService, useValue: service }],
    }).compile();

    controller = module.get<ExperimentsController>(ExperimentsController);
  });

  describe('getAssignments — subject resolution', () => {
    it('prefers the authenticated user id', async () => {
      await controller.getAssignments('user-1', 'visitor-1');
      expect(service.getAssignments).toHaveBeenCalledWith('user-1');
    });

    it('falls back to visitorId for anonymous callers', async () => {
      await controller.getAssignments(undefined, 'visitor-1');
      expect(service.getAssignments).toHaveBeenCalledWith('visitor-1');
    });

    it("falls back to 'anonymous' when neither is present", async () => {
      await controller.getAssignments(undefined, undefined);
      expect(service.getAssignments).toHaveBeenCalledWith('anonymous');
    });
  });

  describe('trackEvent', () => {
    it('resolves the subject and forwards event data', async () => {
      const dto = {
        experimentKey: 'search_test',
        variantId: 'control',
        eventType: ExperimentEventType.SEARCH_CLICK,
        visitorId: 'visitor-1',
        searchQuery: 'car',
        position: 2,
      } as any;

      const res = await controller.trackEvent('user-9', dto);

      expect(res).toEqual({ tracked: true });
      expect(service.trackEvent).toHaveBeenCalledWith(
        'search_test',
        'control',
        ExperimentEventType.SEARCH_CLICK,
        'user-9', // user id wins over visitorId
        expect.objectContaining({ searchQuery: 'car', position: 2 }),
      );
    });

    it('uses visitorId when there is no user', async () => {
      const dto = {
        experimentKey: 'k',
        variantId: 'v',
        eventType: ExperimentEventType.CONVERSION,
        visitorId: 'visitor-2',
      } as any;
      await controller.trackEvent(undefined, dto);
      expect(service.trackEvent).toHaveBeenCalledWith(
        'k',
        'v',
        ExperimentEventType.CONVERSION,
        'visitor-2',
        expect.any(Object),
      );
    });
  });

  describe('admin routes', () => {
    it('lists experiments', async () => {
      await controller.listExperiments();
      expect(service.listAll).toHaveBeenCalled();
    });

    it('creates an experiment from the dto', async () => {
      const dto = { key: 'k', name: 'K', variants: [] } as any;
      await controller.createExperiment(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('starts/pauses/completes by key', async () => {
      await controller.startExperiment('k');
      await controller.pauseExperiment('k');
      await controller.completeExperiment('k');
      expect(service.start).toHaveBeenCalledWith('k');
      expect(service.pause).toHaveBeenCalledWith('k');
      expect(service.complete).toHaveBeenCalledWith('k');
    });

    it('forwards metrics date range and control override', async () => {
      await controller.getMetrics('k', '2026-01-01', '2026-01-31', 'variant');
      expect(service.getMetrics).toHaveBeenCalledWith('k', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        controlVariantId: 'variant',
      });
    });

    it('requests metrics with no filters when none are given', async () => {
      await controller.getMetrics('k');
      expect(service.getMetrics).toHaveBeenCalledWith('k', {
        dateFrom: undefined,
        dateTo: undefined,
        controlVariantId: undefined,
      });
    });
  });
});
