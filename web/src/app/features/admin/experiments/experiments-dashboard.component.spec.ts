import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExperimentsDashboardComponent } from './experiments-dashboard.component';
import { Experiment, ExperimentMetrics, VariantMetrics } from './experiments.types';

function makeExperiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    _id: 'e1',
    key: 'search_test',
    name: 'Search Test',
    description: 'Testing search ranking',
    status: 'running',
    variants: [
      { id: 'control', name: 'Control', weight: 50, config: {} },
      { id: 'variant', name: 'Variant', weight: 50, config: {} },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeVariantMetrics(overrides: Partial<VariantMetrics> = {}): VariantMetrics {
  return {
    variantId: 'control',
    variantName: 'Control',
    weight: 50,
    subjects: 100,
    impressions: 100,
    clicks: 10,
    ctr: 10,
    favorites: 2,
    contacts: 1,
    conversions: 5,
    avgClickPosition: 2.5,
    isControl: true,
    conversionRate: 5,
    convertedSubjects: 5,
    upliftVsControl: null,
    pValue: null,
    confidence: null,
    isSignificant: false,
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<ExperimentMetrics> = {}): ExperimentMetrics {
  return {
    experimentKey: 'search_test',
    experimentName: 'Search Test',
    status: 'running',
    totalSubjects: 200,
    controlVariantId: 'control',
    winnerVariantId: null,
    variants: [
      makeVariantMetrics(),
      makeVariantMetrics({
        variantId: 'variant',
        variantName: 'Variant',
        isControl: false,
        conversionRate: 15,
        convertedSubjects: 15,
        upliftVsControl: 200,
        pValue: 0.001,
        confidence: 99.9,
        isSignificant: true,
      }),
    ],
    ...overrides,
  };
}

describe('ExperimentsDashboardComponent', () => {
  let component: ExperimentsDashboardComponent;
  let httpMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    httpMock = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn().mockReturnValue(of({})),
      patch: vi.fn().mockReturnValue(of({})),
    };

    const injector = Injector.create({
      providers: [{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } }],
    });

    component = runInInjectionContext(
      injector,
      () => new ExperimentsDashboardComponent(httpMock as any, new FormBuilder()),
    );
  });

  describe('loadExperiments', () => {
    it('populates the experiments signal and clears loading', () => {
      httpMock.get.mockReturnValue(of([makeExperiment()]));
      component.loadExperiments();
      expect(component.experiments().length).toBe(1);
      expect(component.loading()).toBe(false);
      expect(component.error()).toBeNull();
    });

    it('coerces a non-array response to an empty list', () => {
      httpMock.get.mockReturnValue(of(null));
      component.loadExperiments();
      expect(component.experiments()).toEqual([]);
    });

    it('sets an error message when the request fails', () => {
      httpMock.get.mockReturnValue(throwError(() => new Error('boom')));
      component.loadExperiments();
      expect(component.error()).toBe('Failed to load experiments.');
      expect(component.loading()).toBe(false);
    });
  });

  describe('filteredExperiments', () => {
    beforeEach(() => {
      component.experiments.set([
        makeExperiment({ _id: 'a', key: 'alpha', name: 'Alpha', status: 'running' }),
        makeExperiment({ _id: 'b', key: 'beta', name: 'Beta', status: 'draft' }),
        makeExperiment({ _id: 'c', key: 'gamma', name: 'Gamma', status: 'completed' }),
      ]);
    });

    it('filters by status', () => {
      component.statusFilter = 'draft';
      const list = component.filteredExperiments();
      expect(list).toHaveLength(1);
      expect(list[0].key).toBe('beta');
    });

    it('filters by search query across name/key/description', () => {
      component.searchQuery = 'gamma';
      expect(component.filteredExperiments().map((e) => e.key)).toEqual(['gamma']);
    });

    it('sorts by name ascending when toggled', () => {
      component.toggleSort('name'); // desc first
      component.toggleSort('name'); // -> asc
      expect(component.filteredExperiments().map((e) => e.name)).toEqual([
        'Alpha',
        'Beta',
        'Gamma',
      ]);
    });
  });

  describe('winningVariant', () => {
    it('is null when the backend has not declared a winner', () => {
      component.selectedMetrics.set(makeMetrics({ winnerVariantId: null }));
      expect(component.winningVariant()).toBeNull();
    });

    it('returns the variant matching winnerVariantId', () => {
      component.selectedMetrics.set(makeMetrics({ winnerVariantId: 'variant' }));
      expect(component.winningVariant()?.variantId).toBe('variant');
    });
  });

  describe('leadingVariant', () => {
    it('picks the highest conversion rate among variants with subjects', () => {
      component.selectedMetrics.set(makeMetrics());
      expect(component.leadingVariant()?.variantId).toBe('variant');
    });

    it('is null when no variant has any subjects', () => {
      component.selectedMetrics.set(
        makeMetrics({
          variants: [
            makeVariantMetrics({ subjects: 0 }),
            makeVariantMetrics({ variantId: 'variant', subjects: 0 }),
          ],
        }),
      );
      expect(component.leadingVariant()).toBeNull();
    });
  });

  describe('conversion & funnel charts', () => {
    it('builds conversion-rate series from the variants', () => {
      component.selectedMetrics.set(makeMetrics());
      const chart = component.conversionChart();
      expect(chart.labels).toEqual(['Control', 'Variant']);
      expect(chart.series[0].data).toEqual([5, 15]);
    });

    it('builds one funnel series per variant with 5 stages', () => {
      component.selectedMetrics.set(makeMetrics());
      const chart = component.funnelChart();
      expect(chart.labels).toHaveLength(5);
      expect(chart.series).toHaveLength(2);
      expect(chart.series[0].data).toHaveLength(5);
    });
  });

  describe('loadMetrics date range', () => {
    it('sends dateFrom/dateTo as query params when set', () => {
      httpMock.get.mockReturnValue(of(makeMetrics()));
      component.viewMetrics('search_test');
      component.metricsDateFrom = '2026-01-01';
      component.metricsDateTo = '2026-01-31';
      component.applyMetricsDateRange();

      // Last call is the date-filtered one.
      const lastCall = httpMock.get.mock.calls[httpMock.get.mock.calls.length - 1];
      expect(lastCall[1]).toEqual({
        params: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      });
      expect(component.selectedMetrics()?.experimentKey).toBe('search_test');
    });

    it('sends no params when no range is set', () => {
      httpMock.get.mockReturnValue(of(makeMetrics()));
      component.viewMetrics('search_test');
      const firstCall = httpMock.get.mock.calls[0];
      expect(firstCall[1]).toEqual({ params: {} });
    });

    it('does nothing on applyMetricsDateRange when no experiment is open', () => {
      component.closeMetrics();
      httpMock.get.mockClear();
      component.applyMetricsDateRange();
      expect(httpMock.get).not.toHaveBeenCalled();
    });
  });

  describe('presentation helpers', () => {
    it('labels the control variant', () => {
      expect(component.significanceLabel(makeVariantMetrics({ isControl: true }))).toBe('Control');
    });

    it('labels insufficient data', () => {
      expect(
        component.significanceLabel(makeVariantMetrics({ isControl: false, confidence: null })),
      ).toBe('Not enough data');
    });

    it('labels a significant result with its confidence', () => {
      expect(
        component.significanceLabel(
          makeVariantMetrics({ isControl: false, confidence: 99, isSignificant: true }),
        ),
      ).toBe('Significant (99%)');
    });

    it('formats uplift with a sign, and dash for null', () => {
      expect(component.formatUplift(12.5)).toBe('+12.5%');
      expect(component.formatUplift(-4)).toBe('-4%');
      expect(component.formatUplift(null)).toBe('—');
    });
  });

  describe('actions', () => {
    it('starts an experiment then reloads the list', () => {
      httpMock.patch.mockReturnValue(of({}));
      const reload = vi.spyOn(component, 'loadExperiments');
      component.startExperiment('search_test');
      expect(httpMock.patch).toHaveBeenCalled();
      expect(reload).toHaveBeenCalled();
      expect(component.actionLoading()).toBeNull();
    });
  });
});
