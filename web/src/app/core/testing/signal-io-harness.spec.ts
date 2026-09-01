import { Component, ElementRef, input, model, output, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

/**
 * Guards the test harness itself, not application code.
 *
 * Angular's initializer-based APIs — `input()`, `output()`, `viewChild()`,
 * `model()` — only work when the Angular compiler has processed the file. If the
 * plugin in `vitest.config.ts` is removed or stops applying, TestBed silently
 * falls back to JIT, which can only see members declared with decorators.
 *
 * Nothing throws when that happens. Bindings simply go nowhere: inputs keep their
 * default value and outputs never reach the host, so a component spec quietly
 * asserts against an inert object and can even keep passing for the wrong reason.
 * These tests fail loudly instead, and name the cause.
 *
 * If this file is red, check that `vitest.config.ts` still registers
 * `@analogjs/vite-plugin-angular` before investigating anything else.
 */
@Component({
  selector: 'app-signal-io-child',
  standalone: true,
  template: `<span #marker>marker</span>`,
})
class SignalIoChild {
  readonly items = input<string[]>([]);
  readonly label = input('fallback');
  readonly picked = output<string>();
  readonly draft = model('');
  readonly marker = viewChild<ElementRef<HTMLElement>>('marker');
}

@Component({
  standalone: true,
  imports: [SignalIoChild],
  template: `
    <app-signal-io-child
      [items]="items"
      [label]="label"
      [(draft)]="draft"
      (picked)="picked = $event"
    />
  `,
})
class HostComponent {
  items = ['one', 'two'];
  label = 'from host';
  draft = 'initial';
  picked = '';
}

describe('test harness: Angular initializer-based APIs', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const child = fixture.debugElement.query(By.directive(SignalIoChild))
      .componentInstance as SignalIoChild;
    return { fixture, host: fixture.componentInstance, child };
  }

  it('delivers input() values from a host binding', () => {
    const { child } = setup();
    expect(child.items()).toEqual(['one', 'two']);
    expect(child.label()).toBe('from host');
  });

  it('delivers output() emissions to the host', () => {
    const { fixture, host, child } = setup();
    child.picked.emit('chosen');
    fixture.detectChanges();
    expect(host.picked).toBe('chosen');
  });

  it('binds model() in both directions', () => {
    const { fixture, host, child } = setup();
    expect(child.draft()).toBe('initial');

    child.draft.set('edited by child');
    fixture.detectChanges();
    expect(host.draft).toBe('edited by child');
  });

  it('resolves viewChild() queries', () => {
    const { child } = setup();
    expect(child.marker()?.nativeElement.textContent).toBe('marker');
  });

  it('applies ComponentRef.setInput to a signal input', () => {
    const fixture = TestBed.createComponent(SignalIoChild);
    fixture.componentRef.setInput('items', ['a', 'b', 'c']);
    fixture.detectChanges();
    expect(fixture.componentInstance.items()).toEqual(['a', 'b', 'c']);
  });

  it('falls back to the declared default when no binding is given', () => {
    const fixture = TestBed.createComponent(SignalIoChild);
    fixture.detectChanges();
    expect(fixture.componentInstance.label()).toBe('fallback');
  });
});
