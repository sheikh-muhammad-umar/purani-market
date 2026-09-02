import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { StatTilesComponent, StatTile } from './stat-tiles.component';

describe('StatTilesComponent', () => {
  let fixture: ComponentFixture<StatTilesComponent>;

  const tiles: StatTile[] = [
    { label: 'Leads', value: 7, icon: 'person_check', hint: 'Real people', emphasis: true },
    { label: 'Views', value: 1234, icon: 'visibility' },
    { label: 'Calls', value: 0, icon: 'call' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatTilesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatTilesComponent);
    fixture.componentRef.setInput('tiles', tiles);
    fixture.detectChanges();
  });

  it('renders one tile per figure', () => {
    const rendered = fixture.nativeElement.querySelectorAll('.stat-tile');
    expect(rendered.length).toBe(3);
  });

  it('formats large numbers so they stay readable', () => {
    const values = [...fixture.nativeElement.querySelectorAll('.stat-value')].map(
      (el: HTMLElement) => el.textContent?.trim(),
    );
    expect(values).toContain('1,234');
  });

  it('shows a zero rather than hiding the figure', () => {
    // A seller needs to know nobody has called, which is different from the
    // number being unavailable.
    const values = [...fixture.nativeElement.querySelectorAll('.stat-value')].map(
      (el: HTMLElement) => el.textContent?.trim(),
    );
    expect(values).toContain('0');
  });

  it('marks the emphasised figure', () => {
    const emphasised = fixture.nativeElement.querySelectorAll('.stat-tile.emphasis');
    expect(emphasised.length).toBe(1);
    expect(emphasised[0].textContent).toContain('Leads');
  });

  it('exposes the hint as a tooltip', () => {
    const first = fixture.nativeElement.querySelector('.stat-tile');
    expect(first.getAttribute('title')).toBe('Real people');
  });

  it('labels the group for screen readers', () => {
    fixture.componentRef.setInput('ariaLabel', 'Engagement for my ad');
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('.stat-tiles');
    expect(list.getAttribute('aria-label')).toBe('Engagement for my ad');
  });

  it('switches to the compact variant when asked', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    // Used inside a table row, where full-size tiles would dominate the row.
    expect(fixture.nativeElement.querySelector('.stat-tiles').classList).toContain('compact');
  });
});
