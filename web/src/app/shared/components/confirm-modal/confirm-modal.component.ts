import { Component, Injectable, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  readonly isOpen = signal(false);
  readonly options = signal<ConfirmOptions>({ message: '' });

  private result$ = new Subject<boolean>();

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.options.set({
      title: options.title ?? 'Confirm',
      message: options.message,
      confirmText: options.confirmText ?? 'Delete',
      cancelText: options.cancelText ?? 'Cancel',
      variant: options.variant ?? 'danger',
    });
    this.isOpen.set(true);

    return new Promise<boolean>((resolve) => {
      const sub = this.result$.subscribe((val) => {
        sub.unsubscribe();
        resolve(val);
      });
    });
  }

  respond(value: boolean): void {
    this.isOpen.set(false);
    this.result$.next(value);
  }
}

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (svc.isOpen()) {
      <div class="confirm-overlay" (click)="onOverlay($event)">
        <div class="confirm-card" [attr.data-variant]="svc.options().variant">
          <div class="confirm-icon">
            <span class="material-symbols-rounded">
              {{
                svc.options().variant === 'danger'
                  ? 'warning'
                  : svc.options().variant === 'warning'
                    ? 'help'
                    : 'info'
              }}
            </span>
          </div>
          <h3 class="confirm-title">{{ svc.options().title }}</h3>
          <p class="confirm-message">{{ svc.options().message }}</p>
          <div class="confirm-actions">
            <button class="btn-cancel" (click)="svc.respond(false)">
              {{ svc.options().cancelText }}
            </button>
            <button
              class="btn-confirm"
              [attr.data-variant]="svc.options().variant"
              (click)="svc.respond(true)"
            >
              {{ svc.options().confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.15s ease;
      }

      .confirm-card {
        background: #fff;
        border-radius: 12px;
        padding: 1.75rem;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        animation: slideUp 0.2s ease;
      }

      .confirm-icon {
        margin-bottom: 0.75rem;

        .material-symbols-rounded {
          font-size: 2.5rem;
        }

        [data-variant='danger'] & .material-symbols-rounded {
          color: #ef4444;
        }
        [data-variant='warning'] & .material-symbols-rounded {
          color: #f59e0b;
        }
        [data-variant='info'] & .material-symbols-rounded {
          color: #3b82f6;
        }
      }

      .confirm-title {
        margin: 0 0 0.5rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: #111;
      }

      .confirm-message {
        margin: 0 0 1.5rem;
        font-size: 0.9rem;
        color: #555;
        line-height: 1.5;
      }

      .confirm-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
      }

      .btn-cancel,
      .btn-confirm {
        padding: 0.5rem 1.25rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition:
          background 0.15s,
          transform 0.1s;

        &:active {
          transform: scale(0.97);
        }
      }

      .btn-cancel {
        background: #f3f4f6;
        color: #374151;

        &:hover {
          background: #e5e7eb;
        }
      }

      .btn-confirm {
        color: #fff;

        &[data-variant='danger'] {
          background: #ef4444;
          &:hover {
            background: #dc2626;
          }
        }
        &[data-variant='warning'] {
          background: #f59e0b;
          &:hover {
            background: #d97706;
          }
        }
        &[data-variant='info'] {
          background: #3b82f6;
          &:hover {
            background: #2563eb;
          }
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class ConfirmModalComponent {
  constructor(readonly svc: ConfirmModalService) {}

  onOverlay(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('confirm-overlay')) {
      this.svc.respond(false);
    }
  }
}
