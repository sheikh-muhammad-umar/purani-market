import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConfirmModalService,
  ConfirmModalComponent,
  PackageWarningOptions,
} from './confirm-modal.component';

describe('ConfirmModalService', () => {
  let service: ConfirmModalService;

  beforeEach(() => {
    service = new ConfirmModalService();
  });

  it('should start closed', () => {
    expect(service.isOpen()).toBe(false);
  });

  it('should open modal and set options on confirm()', () => {
    service.confirm({ message: 'Are you sure?', title: 'Test', variant: 'danger' });

    expect(service.isOpen()).toBe(true);
    expect(service.options().message).toBe('Are you sure?');
    expect(service.options().title).toBe('Test');
    expect(service.options().variant).toBe('danger');
  });

  it('should resolve true when respond(true) is called', async () => {
    const promise = service.confirm({ message: 'Delete?' });
    service.respond(true);

    expect(await promise).toBe(true);
    expect(service.isOpen()).toBe(false);
  });

  it('should resolve false when respond(false) is called', async () => {
    const promise = service.confirm({ message: 'Delete?' });
    service.respond(false);

    expect(await promise).toBe(false);
    expect(service.isOpen()).toBe(false);
  });

  it('should apply default options', () => {
    service.confirm({ message: 'Hello' });

    const opts = service.options();
    expect(opts.title).toBe('Confirm');
    expect(opts.confirmText).toBe('Delete');
    expect(opts.cancelText).toBe('Cancel');
    expect(opts.variant).toBe('danger');
  });

  describe('confirmPackageWarning', () => {
    it('should build correct warning for delete action', () => {
      const opts: PackageWarningOptions = {
        packageName: 'Gold Package',
        packageType: 'featured_ads',
        actionType: 'delete',
      };

      service.confirmPackageWarning(opts);

      const result = service.options();
      expect(result.title).toBe('Delete Listing');
      expect(result.message).toContain("'Gold Package'");
      expect(result.message).toContain('(featured_ads)');
      expect(result.message).toContain('non-recoverable');
      expect(result.message).toContain('delete this listing');
      expect(result.confirmText).toBe('Delete');
      expect(result.cancelText).toBe('Cancel');
      expect(result.variant).toBe('warning');
    });

    it('should build correct warning for deactivate action', () => {
      const opts: PackageWarningOptions = {
        packageName: 'Silver Package',
        packageType: 'ad_slots',
        actionType: 'deactivate',
      };

      service.confirmPackageWarning(opts);

      const result = service.options();
      expect(result.title).toBe('Deactivate Listing');
      expect(result.message).toContain("'Silver Package'");
      expect(result.message).toContain('(ad_slots)');
      expect(result.message).toContain('non-recoverable');
      expect(result.message).toContain('deactivate this listing');
      expect(result.confirmText).toBe('Deactivate');
      expect(result.variant).toBe('warning');
    });

    it('should resolve true on confirm', async () => {
      const promise = service.confirmPackageWarning({
        packageName: 'Test',
        packageType: 'featured_ads',
        actionType: 'delete',
      });
      service.respond(true);

      expect(await promise).toBe(true);
    });

    it('should resolve false on cancel', async () => {
      const promise = service.confirmPackageWarning({
        packageName: 'Test',
        packageType: 'featured_ads',
        actionType: 'delete',
      });
      service.respond(false);

      expect(await promise).toBe(false);
    });
  });
});

describe('ConfirmModalComponent', () => {
  it('should close modal when overlay is clicked', () => {
    const service = new ConfirmModalService();
    const component = new ConfirmModalComponent(service);

    service.confirm({ message: 'Test' });
    expect(service.isOpen()).toBe(true);

    const mockEvent = {
      target: { classList: { contains: (cls: string) => cls === 'confirm-overlay' } },
    } as unknown as MouseEvent;

    const promise = service.confirm({ message: 'Test' });
    component.onOverlay(mockEvent);

    expect(service.isOpen()).toBe(false);
  });

  it('should not close modal when card is clicked', () => {
    const service = new ConfirmModalService();
    const component = new ConfirmModalComponent(service);

    service.confirm({ message: 'Test' });

    const mockEvent = {
      target: { classList: { contains: () => false } },
    } as unknown as MouseEvent;

    component.onOverlay(mockEvent);

    expect(service.isOpen()).toBe(true);
  });
});
