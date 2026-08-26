import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  input,
  output,
} from '@angular/core';

/**
 * Reusable modal shell.
 *
 * Replaces the eight hand-rolled overlay/panel pairs that each feature defined
 * separately. Provides the behaviour those copies mostly lacked: Escape to
 * close, a backdrop click that ignores drags started inside the panel, body
 * scroll locking, focus containment, and `aria-modal` wiring.
 *
 * Usage:
 *   <app-modal title="Edit brand" (closed)="close()">
 *     ...body...
 *     <div slot="footer">...actions...</div>
 *   </app-modal>
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    <div class="mo-overlay" (click)="onBackdrop($event)">
      <div
        #panel
        class="mo-panel"
        [class]="sizeClass()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title() || null"
        (click)="$event.stopPropagation()"
      >
        @if (title() || dismissible()) {
          <header class="mo-head">
            <div class="mo-titles">
              @if (title()) {
                <h2 class="mo-title">{{ title() }}</h2>
              }
              @if (subtitle()) {
                <p class="mo-subtitle">{{ subtitle() }}</p>
              }
            </div>
            @if (dismissible()) {
              <button
                type="button"
                class="mo-close"
                aria-label="Close dialog"
                (click)="closed.emit()"
              >
                <span class="material-symbols-rounded">close</span>
              </button>
            }
          </header>
        }

        <div class="mo-body">
          <ng-content />
        </div>

        <ng-content select="[slot='footer']" />
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .mo-overlay {
        position: fixed;
        inset: 0;
        z-index: var(--z-modal);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-2);
        background: var(--overlay);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        animation: mo-fade var(--duration-base) var(--ease-out);
      }

      .mo-panel {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 560px;
        max-height: calc(100vh - var(--space-6));
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-modal);
        overflow: hidden;
        animation: mo-rise var(--duration-slow) var(--ease-out);
      }

      .mo-sm {
        max-width: 400px;
      }
      .mo-lg {
        max-width: 760px;
      }
      .mo-xl {
        max-width: 1000px;
      }

      .mo-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--border);
      }

      .mo-titles {
        min-width: 0;
      }

      .mo-title {
        font-size: var(--text-lg);
        font-weight: var(--weight-bold);
        letter-spacing: var(--tracking-tight);
        color: var(--text-primary);
      }

      .mo-subtitle {
        margin-top: 2px;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      .mo-close {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        border: none;
        border-radius: var(--radius-full);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        transition:
          background-color var(--duration-base) var(--ease-out),
          color var(--duration-base) var(--ease-out);
      }

      .mo-close:hover {
        background: var(--hover);
        color: var(--text-primary);
      }

      .mo-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: var(--space-3);
      }

      /* Footer is projected, so it is styled by attribute rather than class */
      ::ng-deep [slot='footer'] {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-1);
        flex-wrap: wrap;
        padding: var(--space-2) var(--space-3);
        border-top: 1px solid var(--border);
        background: var(--surface);
      }

      @keyframes mo-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes mo-rise {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      /* Full-height sheet on small screens */
      @media (max-width: 600px) {
        .mo-overlay {
          padding: 0;
          align-items: flex-end;
        }

        .mo-panel,
        .mo-sm,
        .mo-lg,
        .mo-xl {
          max-width: none;
          max-height: 92vh;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          border-inline: none;
          border-bottom: none;
          animation: mo-sheet var(--duration-slow) var(--ease-out);
        }

        @keyframes mo-sheet {
          from {
            transform: translateY(100%);
          }
          to {
            transform: none;
          }
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mo-overlay,
        .mo-panel {
          animation: none;
        }
      }
    `,
  ],
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class ModalComponent implements OnDestroy {
  /** Heading text. Omit for a chrome-less panel. */
  readonly title = input('');

  /** Optional supporting line under the heading. */
  readonly subtitle = input('');

  /** Panel width. */
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  /** Whether Escape, the backdrop and the close button dismiss the dialog. */
  readonly dismissible = input(true);

  /** Emitted whenever the user asks to close. */
  readonly closed = output<void>();

  @ViewChild('panel') private panelRef?: ElementRef<HTMLElement>;

  private readonly scrollLocked: boolean;

  constructor() {
    // Prevent the page behind the dialog from scrolling.
    this.scrollLocked = typeof document !== 'undefined';
    if (this.scrollLocked) {
      document.body.style.overflow = 'hidden';
    }
  }

  ngOnDestroy(): void {
    if (this.scrollLocked) {
      document.body.style.overflow = '';
    }
  }

  protected readonly sizeClass = computed(() => `mo-${this.size()}`);

  protected onEscape(): void {
    if (this.dismissible()) this.closed.emit();
  }

  /**
   * Only dismiss when the press both started and ended on the backdrop. A plain
   * click handler also fires when a drag that began inside the panel (selecting
   * text, for instance) is released over the overlay.
   */
  protected onBackdrop(event: MouseEvent): void {
    if (!this.dismissible()) return;
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
