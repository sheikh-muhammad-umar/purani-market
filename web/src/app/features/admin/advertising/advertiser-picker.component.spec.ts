import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AdvertiserPickerComponent } from './advertiser-picker.component';
import { AdvertisingService } from '../../../core/services/advertising.service';
import { Advertiser } from '../../../core/models';

const brand = (id: string, name: string, status = 'active'): Advertiser =>
  ({ _id: id, name, status, createdAt: '', updatedAt: '' }) as Advertiser;

/** Binds the picker exactly as the campaign form does, ngModel included. */
@Component({
  standalone: true,
  imports: [FormsModule, AdvertiserPickerComponent],
  template: `
    <app-advertiser-picker
      [options]="options"
      [(ngModel)]="advertiserId"
      (created)="created.push($event)"
    />
  `,
})
class HostComponent {
  options: Advertiser[] = [brand('a1', 'Bykea Rides'), brand('a2', 'Daraz Express')];
  advertiserId = '';
  created: Advertiser[] = [];
}

describe('AdvertiserPickerComponent', () => {
  let advertising: {
    listAdvertisers: ReturnType<typeof vi.fn>;
    createAdvertiser: ReturnType<typeof vi.fn>;
    getAdvertiser: ReturnType<typeof vi.fn>;
  };

  /**
   * `advertiserId` is seeded before the first change detection: setting it after
   * one has already run trips dev-mode's ExpressionChangedAfterItHasBeenChecked.
   */
  function make(advertiserId = '') {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.advertiserId = advertiserId;
    fixture.detectChanges();
    const cmp = fixture.debugElement.query(By.directive(AdvertiserPickerComponent))
      .componentInstance as AdvertiserPickerComponent;
    return { fixture, host: fixture.componentInstance, cmp };
  }

  /** Opens the panel and flushes the focus timer so fakeAsync ends clean. */
  function open(cmp: AdvertiserPickerComponent) {
    cmp.toggle();
    tick();
  }

  beforeEach(() => {
    advertising = {
      listAdvertisers: vi.fn().mockReturnValue(of([])),
      createAdvertiser: vi.fn(),
      getAdvertiser: vi.fn().mockReturnValue(of(brand('zz', 'Fetched Brand'))),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AdvertisingService, useValue: advertising }],
    });
  });

  it('shows the preloaded roster without a request', fakeAsync(() => {
    const { cmp } = make();
    open(cmp);
    expect(cmp.open()).toBe(true);
    expect(cmp.visible().map((a) => a.name)).toEqual(['Bykea Rides', 'Daraz Express']);
    expect(advertising.listAdvertisers).not.toHaveBeenCalled();
  }));

  it('debounces typing into one capped search request', fakeAsync(() => {
    const { cmp } = make();
    advertising.listAdvertisers.mockReturnValue(of([brand('a2', 'Daraz Express')]));
    open(cmp);

    cmp.onSearch('d');
    cmp.onSearch('da');
    cmp.onSearch('dar');
    expect(advertising.listAdvertisers).not.toHaveBeenCalled();

    tick(300);
    expect(advertising.listAdvertisers).toHaveBeenCalledTimes(1);
    expect(advertising.listAdvertisers).toHaveBeenCalledWith('dar', 20);
    expect(cmp.visible().map((a) => a.name)).toEqual(['Daraz Express']);
  }));

  it('offers creation only for an unmatched name of usable length', fakeAsync(() => {
    const { cmp } = make();
    open(cmp);

    advertising.listAdvertisers.mockReturnValue(of([]));
    cmp.onSearch('Nestle Pakistan');
    tick(300);
    expect(cmp.canCreate()).toBe(true);

    // Below the backend's MinLength(2).
    cmp.onSearch('N');
    tick(300);
    expect(cmp.canCreate()).toBe(false);

    // An exact hit, ignoring case, is a pick rather than a create.
    advertising.listAdvertisers.mockReturnValue(of([brand('a2', 'Daraz Express')]));
    cmp.onSearch('daraz express');
    tick(300);
    expect(cmp.canCreate()).toBe(false);
  }));

  it('creates inline, then selects it and pushes the id through ngModel', fakeAsync(() => {
    const { fixture, host, cmp } = make();
    const fresh = brand('new1', 'Nestle Pakistan');
    advertising.listAdvertisers.mockReturnValue(of([]));
    advertising.createAdvertiser.mockReturnValue(of(fresh));

    open(cmp);
    cmp.onSearch('Nestle Pakistan');
    tick(300);
    cmp.createFromQuery();
    tick();
    fixture.detectChanges();

    expect(advertising.createAdvertiser).toHaveBeenCalledWith({ name: 'Nestle Pakistan' });
    expect(host.created).toEqual([fresh]);
    expect(host.advertiserId).toBe('new1');
    expect(cmp.displayName()).toBe('Nestle Pakistan');
    expect(cmp.open()).toBe(false);
  }));

  it('trims the typed name before sending it', fakeAsync(() => {
    const { cmp } = make();
    advertising.listAdvertisers.mockReturnValue(of([]));
    advertising.createAdvertiser.mockReturnValue(of(brand('new2', 'Shan Foods')));

    open(cmp);
    cmp.onSearch('   Shan Foods   ');
    tick(300);
    cmp.createFromQuery();
    tick();

    expect(advertising.createAdvertiser).toHaveBeenCalledWith({ name: 'Shan Foods' });
  }));

  it('recovers from a duplicate name by re-searching, not dead-ending', fakeAsync(() => {
    const { host, cmp } = make();
    advertising.listAdvertisers.mockReturnValue(of([]));
    advertising.createAdvertiser.mockReturnValue(throwError(() => ({ status: 409 })));

    open(cmp);
    cmp.onSearch('Daraz Express');
    tick(300);

    advertising.listAdvertisers.mockReturnValue(of([brand('a2', 'Daraz Express')]));
    cmp.createFromQuery();
    tick(300);

    expect(cmp.createError()).toContain('already exists');
    expect(host.advertiserId).toBe('');
    // The existing brand is now on screen to pick.
    expect(cmp.visible().map((a) => a.name)).toEqual(['Daraz Express']);
  }));

  it('keyboard: arrow down twice then enter picks the second brand', fakeAsync(() => {
    const { fixture, host, cmp } = make();
    open(cmp);

    cmp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(cmp.activeIndex()).toBe(0);
    cmp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(cmp.activeIndex()).toBe(1);

    cmp.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    tick();
    fixture.detectChanges();

    expect(host.advertiserId).toBe('a2');
    expect(cmp.displayName()).toBe('Daraz Express');
    expect(cmp.open()).toBe(false);
  }));

  it('escape closes without selecting', fakeAsync(() => {
    const { host, cmp } = make();
    open(cmp);
    cmp.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cmp.open()).toBe(false);
    expect(host.advertiserId).toBe('');
  }));

  it('names a preselected id from the preloaded roster, without a lookup', fakeAsync(() => {
    const { cmp } = make('a1');
    tick();
    expect(cmp.displayName()).toBe('Bykea Rides');
    expect(advertising.getAdvertiser).not.toHaveBeenCalled();
  }));

  it('looks up a preselected id the host did not preload', fakeAsync(() => {
    const { cmp } = make('zz');
    tick();
    expect(advertising.getAdvertiser).toHaveBeenCalledWith('zz');
    expect(cmp.displayName()).toBe('Fetched Brand');
  }));

  it('survives a failed search without wedging the panel', fakeAsync(() => {
    const { cmp } = make();
    advertising.listAdvertisers.mockReturnValue(throwError(() => ({ status: 500 })));
    open(cmp);
    cmp.onSearch('anything');
    tick(300);

    expect(cmp.searchError()).toBeTruthy();
    expect(cmp.searching()).toBe(false);
    // Creation still available, so a flaky lookup does not block the operator.
    expect(cmp.canCreate()).toBe(true);
  }));
});
