import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';

interface RejectionReason {
  _id: string;
  title: string;
  description?: string;
  isActive: boolean;
}

@Component({
  selector: 'app-rejection-reasons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rejection-reasons.component.html',
  styleUrl: './rejection-reasons.component.scss',
})
export class RejectionReasonsComponent implements OnInit {
  readonly loading = signal(true);
  readonly reasons = signal<RejectionReason[]>([]);
  readonly saving = signal(false);

  editingId: string | null = null;
  editTitle = '';
  editDescription = '';

  newTitle = '';
  newDescription = '';
  showAddForm = false;

  deletingId: string | null = null;

  // Search, filter, sort
  searchQuery = '';
  filterStatus = '';
  sortCol: 'title' | '' = '';
  sortDir: 'asc' | 'desc' = 'asc';

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    this.loadReasons();
  }

  get filteredReasons(): RejectionReason[] {
    let result = this.reasons();

    // Search
    const q = this.searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(r => r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
    }

    // Status filter
    if (this.filterStatus === 'active') {
      result = result.filter(r => r.isActive);
    } else if (this.filterStatus === 'inactive') {
      result = result.filter(r => !r.isActive);
    }

    // Sort
    if (this.sortCol) {
      const dir = this.sortDir === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        return (a.title || '').localeCompare(b.title || '') * dir;
      });
    }

    return result;
  }

  sortBy(col: 'title'): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
  }

  sortIcon(col: string): string {
    if (col !== this.sortCol) return 'unfold_more';
    return this.sortDir === 'asc' ? 'expand_less' : 'expand_more';
  }

  loadReasons(): void {
    this.loading.set(true);
    this.adminService.getRejectionReasons(true).subscribe({
      next: (res) => {
        this.reasons.set(res);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  startAdd(): void {
    this.showAddForm = true;
    this.newTitle = '';
    this.newDescription = '';
  }

  cancelAdd(): void {
    this.showAddForm = false;
  }

  saveNew(): void {
    if (!this.newTitle.trim()) return;
    this.saving.set(true);
    this.adminService.createRejectionReason({ title: this.newTitle.trim(), description: this.newDescription.trim() || undefined }).subscribe({
      next: () => {
        this.showAddForm = false;
        this.saving.set(false);
        this.loadReasons();
      },
      error: () => { this.saving.set(false); },
    });
  }

  startEdit(reason: RejectionReason): void {
    this.editingId = reason._id;
    this.editTitle = reason.title;
    this.editDescription = reason.description || '';
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editTitle.trim()) return;
    this.saving.set(true);
    this.adminService.updateRejectionReason(this.editingId, { title: this.editTitle.trim(), description: this.editDescription.trim() || undefined }).subscribe({
      next: () => {
        this.editingId = null;
        this.saving.set(false);
        this.loadReasons();
      },
      error: () => { this.saving.set(false); },
    });
  }

  toggleActive(reason: RejectionReason): void {
    this.adminService.updateRejectionReason(reason._id, { isActive: !reason.isActive }).subscribe({
      next: () => { this.loadReasons(); },
    });
  }

  deleteReason(reason: RejectionReason): void {
    this.deletingId = reason._id;
  }

  confirmDelete(): void {
    if (!this.deletingId) return;
    this.adminService.deleteRejectionReason(this.deletingId).subscribe({
      next: () => {
        this.deletingId = null;
        this.loadReasons();
      },
    });
  }

  cancelDelete(): void {
    this.deletingId = null;
  }
}
