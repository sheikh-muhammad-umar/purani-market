import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { ReportModalComponent } from './report-modal.component';
import { ReportsService } from '../../../core/services/reports.service';
import { ToastService } from '../../../core/services/toast.service';
import { ReportReason, ReportTargetType } from '../../../core/models/report.model';

describe('ReportModalComponent', () => {
  let component: ReportModalComponent;
  let ref: ComponentRef<ReportModalComponent>;
  let reportsService: { submit: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reportsService = { submit: vi.fn().mockReturnValue(of({})) };
    toast = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ReportModalComponent],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: ToastService, useValue: toast },
      ],
    });

    const fixture = TestBed.createComponent(ReportModalComponent);
    ref = fixture.componentRef;
    component = fixture.componentInstance;
    ref.setInput('targetType', ReportTargetType.LISTING);
    ref.setInput('targetId', 'listing-1');
    ref.setInput('targetLabel', 'Honda Civic');
  });

  it('is invalid until the message reaches the minimum length', () => {
    component.message.set('short');
    expect(component.isValid()).toBe(false);
    component.message.set('This is a detailed enough report message.');
    expect(component.isValid()).toBe(true);
  });

  it('caps the message at the maximum length', () => {
    component.onMessageChange('a'.repeat(3000));
    expect(component.messageLength()).toBe(component.MAX_MESSAGE);
  });

  it('does not submit when invalid', () => {
    component.message.set('too short');
    component.submit();
    expect(reportsService.submit).not.toHaveBeenCalled();
  });

  it('submits with target, reason, message and emits closed', () => {
    const closedSpy = vi.fn();
    const submittedSpy = vi.fn();
    component.closed.subscribe(closedSpy);
    component.submitted.subscribe(submittedSpy);

    component.reason.set(ReportReason.SCAM);
    component.message.set('This seller is running a clear scam operation.');
    component.submit();

    expect(reportsService.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: ReportTargetType.LISTING,
        targetId: 'listing-1',
        reason: ReportReason.SCAM,
        message: 'This seller is running a clear scam operation.',
      }),
    );
    expect(toast.success).toHaveBeenCalled();
    expect(submittedSpy).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
  });

  it('surfaces an error and stays open when submit fails', () => {
    reportsService.submit.mockReturnValue(throwError(() => new Error('fail')));
    component.message.set('This is a valid length report message.');
    component.submit();
    expect(component.error()).toBeTruthy();
    expect(toast.error).toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
  });

  it('rejects disallowed file types and enforces the screenshot cap', () => {
    // Disallowed type.
    const badEvent = {
      target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })], value: '' },
    } as any;
    component.onFilesSelected(badEvent);
    expect(component.error()).toContain('JPEG');
    expect(component.previews().length).toBe(0);
  });

  it('removes a screenshot by index', () => {
    component.previews.set([
      { file: {} as File, url: 'a' },
      { file: {} as File, url: 'b' },
    ]);
    component.removeScreenshot(0);
    expect(component.previews().map((p) => p.url)).toEqual(['b']);
  });
});
