import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';
import { AdminService, AnalyticsData } from '../../../core/services/admin.service';

const mockAnalytics: AnalyticsData = {
  metrics: {
    totalUsers: 1200,
    activeUsers: 450,
    totalListings: 3400,
    totalConversations: 890,
    totalPurchases: 120,
    totalRevenue: 560000,
  },
  timeSeries: {
    registrations: [
      { date: '2024-01-01', value: 10 },
      { date: '2024-01-02', value: 15 },
    ],
    listings: [{ date: '2024-01-01', value: 20 }],
    conversations: [{ date: '2024-01-01', value: 5 }],
    purchases: [{ date: '2024-01-01', value: 3 }],
  },
  categoryAnalytics: [
    { categoryId: 'c1', categoryName: 'Electronics', listingCount: 500 },
    { categoryId: 'c2', categoryName: 'Vehicles', listingCount: 300 },
  ],
};

describe('AnalyticsDashboardComponent', () => {
  let component: AnalyticsDashboardComponent;
  let adminService: {
    getAnalytics: ReturnType<typeof vi.fn>;
    exportReport: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    adminService = {
      getAnalytics: vi.fn().mockReturnValue(of(mockAnalytics)),
      exportReport: vi.fn().mockReturnValue(of(new Blob(['test'], { type: 'text/csv' }))),
    };
    component = new AnalyticsDashboardComponent(adminService as unknown as AdminService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load analytics on init', () => {
    component.ngOnInit();
    expect(adminService.getAnalytics).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.metrics()).toEqual(mockAnalytics.metrics);
  });

  it('should set default date range on init', () => {
    component.ngOnInit();
    expect(component.startDate).toBeTruthy();
    expect(component.endDate).toBeTruthy();
  });

  it('should populate time series data', () => {
    component.ngOnInit();
    const ts = component.timeSeries();
    expect(ts).toBeTruthy();
    expect(ts!.registrations.length).toBe(2);
    expect(ts!.listings.length).toBe(1);
  });

  it('should populate category analytics', () => {
    component.ngOnInit();
    expect(component.categoryAnalytics().length).toBe(2);
    expect(component.categoryAnalytics()[0].categoryName).toBe('Electronics');
  });

  it('should compute metric cards from metrics', () => {
    component.ngOnInit();
    const cards = component.metricCards();
    expect(cards.length).toBe(6);
    expect(cards[0].label).toBe('Total Users');
    expect(cards[0].value).toBe(1200);
    expect(cards[5].label).toBe('Revenue');
    expect(cards[5].format).toBe('currency');
  });

  it('should return empty metric cards when no metrics', () => {
    expect(component.metricCards().length).toBe(0);
  });

  it('should handle load error', () => {
    adminService.getAnalytics.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load analytics data. Please try again.');
  });

  it('should format number values', () => {
    expect(component.formatValue(1200, 'number')).toBe('1,200');
  });

  it('should format currency values', () => {
    expect(component.formatValue(560000, 'currency')).toContain('Rs');
    expect(component.formatValue(560000, 'currency')).toContain('560');
  });

  it('should compute max category count', () => {
    component.ngOnInit();
    expect(component.maxCategoryCount()).toBe(500);
  });

  it('should return 1 for max category count when empty', () => {
    expect(component.maxCategoryCount()).toBe(1);
  });

  it('should calculate bar width as percentage', () => {
    component.ngOnInit();
    expect(component.getBarWidth(500)).toBe(100);
    expect(component.getBarWidth(250)).toBe(50);
  });

  it('should calculate bar height as percentage', () => {
    expect(component.getBarHeight(10, 20)).toBe(50);
    expect(component.getBarHeight(20, 20)).toBe(100);
  });

  it('should get max time series value', () => {
    expect(component.getMaxTimeSeriesValue([{ date: '2024-01-01', value: 10 }, { date: '2024-01-02', value: 20 }])).toBe(20);
  });

  it('should return 1 for empty time series', () => {
    expect(component.getMaxTimeSeriesValue([])).toBe(1);
  });

  it('should format short date', () => {
    const result = component.formatShortDate('2024-01-15');
    expect(result).toContain('1/');
    expect(result).toContain('15');
  });

  it('should reload analytics on applyDateRange', () => {
    component.ngOnInit();
    adminService.getAnalytics.mockClear();
    component.applyDateRange();
    expect(adminService.getAnalytics).toHaveBeenCalled();
  });

  it('should export report and trigger download', () => {
    component.ngOnInit();
    // Mock document.createElement and URL methods
    const mockAnchor = { href: '', download: '', click: vi.fn() } as any;
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    component.exportReport();

    expect(adminService.exportReport).toHaveBeenCalledWith({
      startDate: component.startDate,
      endDate: component.endDate,
    });
    expect(component.exporting()).toBe(false);
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it('should not export when dates are missing', () => {
    component.startDate = '';
    component.endDate = '';
    component.exportReport();
    expect(adminService.exportReport).not.toHaveBeenCalled();
  });

  it('should handle export error', () => {
    component.ngOnInit();
    adminService.exportReport.mockReturnValue(throwError(() => new Error('export fail')));
    component.exportReport();
    expect(component.exporting()).toBe(false);
  });
});
