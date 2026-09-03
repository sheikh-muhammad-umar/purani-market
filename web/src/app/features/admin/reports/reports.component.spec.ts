import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsComponent } from './reports.component';
import { AdminReport, ReportStatus, ReportTargetType } from '../../../core/models/report.model';

function makeReport(overrides: Partial<AdminReport> = {}): AdminReport {
  return {
    _id: 'r1',
    targetType: ReportTargetType.LISTING,
    reason: 'scam' as any,
    message: 'This is a scam listing',
    screenshots: [],
    status: ReportStatus.PENDING,
    createdAt: '2026-01-01T00:00:00.000Z',
    reporter: {
      _id: 'u1',
      email: 'reporter@test.com',
      profile: { firstName: 'Rep', lastName: 'Orter' },
    },
    reportedUser: { _id: 'u2', email: 'seller@test.com', reportCount: 2, status: 'active' },
    ...overrides,
  };
}

describe('ReportsComponent (admin)', () => {
  let component: ReportsComponent;
  let http: { get: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    http = {
      get: vi.fn().mockReturnValue(of({ data: [makeReport()], total: 1 })),
      patch: vi.fn().mockReturnValue(of({ reportCount: 3, suspended: false })),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    component = new ReportsComponent(http as any, toast as any);
  });

  it('loads reports and unwraps {data,total}', () => {
    component.loadReports();
    expect(component.reports().length).toBe(1);
    expect(component.total()).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('sets an error when loading fails', () => {
    http.get.mockReturnValue(throwError(() => new Error('boom')));
    component.loadReports();
    expect(component.error()).toBe('Failed to load reports.');
    expect(component.loading()).toBe(false);
  });

  it('sends status filter and search as query params', () => {
    component.statusFilter = ReportStatus.APPROVED;
    component.searchQuery = 'fraud';
    component.loadReports();
    const params = http.get.mock.calls[0][1].params;
    expect(params.get('status')).toBe(ReportStatus.APPROVED);
    expect(params.get('search')).toBe('fraud');
  });

  it('resets to page 1 on filter change', () => {
    component.currentPage.set(4);
    component.onFilterChange();
    expect(component.currentPage()).toBe(1);
  });

  it('displays reporter and reported names from profile/email', () => {
    const r = makeReport();
    expect(component.reporterName(r)).toBe('Rep Orter');
    expect(component.reportedName(r)).toBe('seller@test.com'); // no profile -> email
  });

  it('approves a report and reloads', () => {
    const r = makeReport();
    component.openDetail(r);
    component.approve();
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/reports/admin/r1/review'), {
      status: ReportStatus.APPROVED,
    });
    expect(toast.success).toHaveBeenCalled();
    expect(component.selected()).toBeNull(); // closed after review
  });

  it('shows the suspension message when approval suspended the account', () => {
    http.patch.mockReturnValue(of({ reportCount: 4, suspended: true }));
    component.openDetail(makeReport());
    component.approve();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('suspended'));
  });

  it('rejects with an optional note', () => {
    component.openDetail(makeReport());
    component.startReject();
    component.reviewNote = 'Not a real violation';
    component.confirmReject();
    expect(http.patch).toHaveBeenCalledWith(expect.any(String), {
      status: ReportStatus.REJECTED,
      reviewNote: 'Not a real violation',
    });
  });

  it('surfaces an error toast when review fails', () => {
    http.patch.mockReturnValue(throwError(() => new Error('fail')));
    component.openDetail(makeReport());
    component.approve();
    expect(toast.error).toHaveBeenCalled();
    expect(component.actionLoading()).toBeNull();
  });

  it('manages the screenshot lightbox', () => {
    component.openLightbox('http://x/shot.png');
    expect(component.lightboxUrl).toBe('http://x/shot.png');
    component.closeLightbox();
    expect(component.lightboxUrl).toBeNull();
  });
});
