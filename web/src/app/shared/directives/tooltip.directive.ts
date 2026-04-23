import { Directive, ElementRef, Input, OnDestroy, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') text = '';

  private tooltip: HTMLElement | null = null;
  private onMouseMove = (e: MouseEvent) => this.move(e);
  private onMouseEnter = (e: MouseEvent) => this.show(e);
  private onMouseLeave = () => this.hide();

  constructor(
    private readonly el: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
  ) {
    this.el.nativeElement.addEventListener('mouseenter', this.onMouseEnter);
    this.el.nativeElement.addEventListener('mouseleave', this.onMouseLeave);
    this.el.nativeElement.addEventListener('mousemove', this.onMouseMove);
  }

  private show(e: MouseEvent): void {
    if (!this.text) return;
    this.tooltip = this.renderer.createElement('div');
    this.renderer.addClass(this.tooltip, 'app-tooltip');
    this.tooltip!.textContent = this.text;
    this.renderer.appendChild(document.body, this.tooltip);
    this.position(e);
    requestAnimationFrame(() => {
      if (this.tooltip) this.renderer.addClass(this.tooltip, 'visible');
    });
  }

  private move(e: MouseEvent): void {
    if (this.tooltip) this.position(e);
  }

  private position(e: MouseEvent): void {
    if (!this.tooltip) return;
    const x = e.clientX + 12;
    const y = e.clientY - 8;
    const rect = this.tooltip.getBoundingClientRect();

    // Keep within viewport
    const maxX = window.innerWidth - (rect.width || 200) - 16;
    const maxY = 8;

    this.tooltip.style.left = `${Math.min(x, maxX)}px`;
    this.tooltip.style.top = `${Math.max(y - (rect.height || 0), maxY)}px`;
  }

  private hide(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  ngOnDestroy(): void {
    this.hide();
    this.el.nativeElement.removeEventListener('mouseenter', this.onMouseEnter);
    this.el.nativeElement.removeEventListener('mouseleave', this.onMouseLeave);
    this.el.nativeElement.removeEventListener('mousemove', this.onMouseMove);
  }
}
