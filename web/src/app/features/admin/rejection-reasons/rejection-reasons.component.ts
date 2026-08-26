import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

interface RejectionReason {
  _id: string;
  title: string;
  description?: string;
  requiresNote: boolean;
  sortOrder: number;
  isActive: boolean;
}

@Component({
  selector: 'app-rejection-reasons',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  templateUrl: './rejection-reasons.component.html',
  styleUrl: './rejection-reasons.component.scss',
})
export class RejectionReasonsComponent implements OnInit {
  readonly loading = signal(true);
  readonly reasons = signal<RejectionReason[]>([]);
  readonly saving = signal(false);

  showForm = false;
  editingId: string | null = null;

  formTitle = '';
  formDescription = '';
  formRequiresNote = false;
  formSortOrder = 0;

  constructor(
    private readonly adminService: AdminService,
    private readonly confirmModal: ConfirmModalService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadReasons();
  }

  loadReasons(): void {
    this.loading.set(true);
    this.adminService.getRejectionReasons(true).subscribe({
      next: (res) => {
        this.reasons.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load rejection reasons.');
      },
    });
  }

  editReason(reason: RejectionReason): void {
    this.editingId = reason._id;
    this.formTitle = reason.title;
    this.formDescription = reason.description || '';
    this.formRequiresNote = reason.requiresNote ?? false;
    this.formSortOrder = reason.sortOrder ?? 0;
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.formTitle = '';
    this.formDescription = '';
    this.formRequiresNote = false;
    this.formSortOrder = 0;
  }

  saveReason(): void {
    if (!this.formTitle.trim()) return;
    this.saving.set(true);

    const body = {
      title: this.formTitle.trim(),
      description: this.formDescription.trim() || undefined,
      requiresNote: this.formRequiresNote,
      sortOrder: this.formSortOrder,
    };

    const req$ = this.editingId
      ? this.adminService.updateRejectionReason(this.editingId, body)
      : this.adminService.createRejectionReason(body);

    req$.subscribe({
      next: () => {
        this.toast.success(this.editingId ? 'Reason updated.' : 'Reason created.');
        this.saving.set(false);
        this.cancelForm();
        this.loadReasons();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Failed to save reason.');
      },
    });
  }

  async deleteReason(reason: RejectionReason): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Delete Rejection Reason',
      message: `Delete "${reason.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    this.adminService.deleteRejectionReason(reason._id).subscribe({
      next: () => {
        this.toast.success('Reason deleted.');
        this.loadReasons();
      },
      error: () => this.toast.error('Failed to delete reason.'),
    });
  }

  async toggleActive(reason: RejectionReason): Promise<void> {
    this.adminService.updateRejectionReason(reason._id, { isActive: !reason.isActive }).subscribe({
      next: () => {
        this.toast.success(reason.isActive ? 'Reason deactivated.' : 'Reason activated.');
        this.loadReasons();
      },
      error: () => this.toast.error('Failed to update reason.'),
    });
  }
}
