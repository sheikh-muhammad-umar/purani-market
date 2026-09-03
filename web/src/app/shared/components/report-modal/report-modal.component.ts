import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { CustomSelectComponent, SelectOption } from '../custom-select/custom-select.component';
import { ReportsService } from '../../../core/services/reports.service';
import { ToastService } from '../../../core/services/toast.service';
import { ReportReason, ReportTargetType } from '../../../core/models/report.model';

const MAX_MESSAGE = 2000;
const MIN_MESSAGE = 10;
const MAX_SCREENSHOTS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Preview {
  file: File;
  url: string;
}

/**
 * A reusable "Report" dialog for a seller or a listing.
 *
 * Drop it in guarded by a boolean, pass the target, and listen for `closed`.
 * It handles message + reason + up to five screenshots and posts multipart.
 */
@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, CustomSelectComponent],
  templateUrl: './report-modal.component.html',
  styleUrl: './report-modal.component.scss',
})
export class ReportModalComponent {
  readonly targetType = input.required<ReportTargetType>();
  readonly targetId = input.required<string>();
  /** Optional label of what's being reported, shown in the subtitle. */
  readonly targetLabel = input<string>('');

  readonly closed = output<void>();
  readonly submitted = output<void>();

  readonly MAX_MESSAGE = MAX_MESSAGE;
  readonly MAX_SCREENSHOTS = MAX_SCREENSHOTS;

  readonly reason = signal<ReportReason>(ReportReason.OTHER);
  readonly message = signal('');
  readonly previews = signal<Preview[]>([]);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly reasonOptions: SelectOption[] = [
    { value: ReportReason.SPAM, label: 'Spam' },
    { value: ReportReason.SCAM, label: 'Scam or fraud' },
    { value: ReportReason.PROHIBITED, label: 'Prohibited item' },
    { value: ReportReason.COUNTERFEIT, label: 'Counterfeit' },
    { value: ReportReason.OFFENSIVE, label: 'Offensive or abusive' },
    { value: ReportReason.OTHER, label: 'Other' },
  ];

  readonly subtitle = computed(() => {
    const kind = this.targetType() === ReportTargetType.LISTING ? 'listing' : 'seller';
    return this.targetLabel()
      ? `Reporting ${kind}: ${this.targetLabel()}`
      : `Reporting this ${kind}`;
  });

  readonly messageLength = computed(() => this.message().length);

  readonly isValid = computed(() => {
    const len = this.message().trim().length;
    return len >= MIN_MESSAGE && len <= MAX_MESSAGE && !this.submitting();
  });

  constructor(
    private readonly reportsService: ReportsService,
    private readonly toast: ToastService,
  ) {}

  onMessageChange(value: string): void {
    this.message.set(value.slice(0, MAX_MESSAGE));
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // allow re-selecting the same file

    for (const file of files) {
      if (this.previews().length >= MAX_SCREENSHOTS) {
        this.error.set(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        this.error.set('Only JPEG, PNG, and WebP images are allowed.');
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        this.error.set('Each screenshot must be 5MB or smaller.');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.previews.update((p) => [...p, { file, url: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    }
  }

  removeScreenshot(index: number): void {
    this.previews.update((p) => p.filter((_, i) => i !== index));
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.isValid()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.reportsService
      .submit({
        targetType: this.targetType(),
        targetId: this.targetId(),
        message: this.message().trim(),
        reason: this.reason(),
        screenshots: this.previews().map((p) => p.file),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.success('Report submitted. Our team will review it.');
          this.submitted.emit();
          this.closed.emit();
        },
        error: () => {
          this.submitting.set(false);
          const msg = 'Failed to submit report. Please try again.';
          this.error.set(msg);
          this.toast.error(msg);
        },
      });
  }
}
