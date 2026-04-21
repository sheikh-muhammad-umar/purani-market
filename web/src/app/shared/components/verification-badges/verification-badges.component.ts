import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-verification-badges',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vb-wrap" [class.vb-compact]="compact">
      <span
        class="vb-badge"
        [class.verified]="emailVerified"
        [title]="emailVerified ? 'Email verified' : 'Email not verified'"
      >
        <span class="material-symbols-rounded vb-icon">mail</span>
        @if (!compact) {
          <span class="vb-label">Email</span>
        }
      </span>
      <span
        class="vb-badge"
        [class.verified]="phoneVerified"
        [title]="phoneVerified ? 'Phone verified' : 'Phone not verified'"
      >
        <span class="material-symbols-rounded vb-icon">phone</span>
        @if (!compact) {
          <span class="vb-label">Phone</span>
        }
      </span>
      <span
        class="vb-badge"
        [class.verified]="idVerified"
        [class.vb-future]="!idVerified"
        [title]="idVerified ? 'ID verified' : 'ID not verified'"
      >
        <span class="material-symbols-rounded vb-icon">badge</span>
        @if (!compact) {
          <span class="vb-label">ID</span>
        }
      </span>
    </div>
  `,
  styles: [
    `
      .vb-wrap {
        display: inline-flex;
        gap: 6px;
        align-items: center;
      }
      .vb-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 8px;
        border-radius: 100px;
        font-size: 11px;
        font-weight: 600;
        background: var(--background);
        color: var(--text-muted);
        border: 1px solid var(--border);
      }
      .vb-badge.verified {
        background: rgba(0, 184, 148, 0.1);
        color: #00b894;
        border-color: rgba(0, 184, 148, 0.3);
      }
      .vb-badge.vb-future {
        opacity: 0.5;
      }
      .vb-icon {
        font-size: 14px;
      }
      .vb-label {
        font-size: 11px;
      }
      .vb-compact .vb-badge {
        padding: 2px 4px;
        border-radius: 4px;
      }
      .vb-compact .vb-icon {
        font-size: 12px;
      }
    `,
  ],
})
export class VerificationBadgesComponent {
  @Input() emailVerified = false;
  @Input() phoneVerified = false;
  @Input() idVerified = false;
  @Input() compact = false;
}
