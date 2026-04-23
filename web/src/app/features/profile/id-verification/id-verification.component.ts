import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { ROUTES } from '../../../core/constants/routes';
import { API } from '../../../core/constants/api-endpoints';
import {
  IdVerificationMyStatus,
  IdVerificationStatus,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from '../../../core/models/id-verification.model';

type CnicField = 'cnicFront' | 'cnicBack' | 'selfieFront' | 'selfieBack';

@Component({
  selector: 'app-id-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './id-verification.component.html',
  styleUrl: './id-verification.component.scss',
})
export class IdVerificationComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly IdVerificationStatus = IdVerificationStatus;
  private readonly apiUrl = environment.apiUrl;

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly verification = signal<IdVerificationMyStatus | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly isIdVerified = signal(false);

  cnicFrontFile: File | null = null;
  cnicBackFile: File | null = null;
  selfieFrontFile: File | null = null;
  selfieBackFile: File | null = null;

  readonly cnicFrontPreview = signal('');
  readonly cnicBackPreview = signal('');
  readonly selfieFrontPreview = signal('');
  readonly selfieBackPreview = signal('');

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.loading.set(true);
    this.http
      .get<IdVerificationMyStatus>(`${this.apiUrl}${API.ID_VERIFICATION_MY_STATUS}`)
      .subscribe({
        next: (res) => {
          const data = (res as any)?.statusCode ? (res as any).data : res;
          this.verification.set(data);
          this.loading.set(false);
          this.authService.fetchCurrentUser().subscribe({
            next: (user) => this.isIdVerified.set(user?.idVerified ?? false),
          });
        },
        error: () => {
          this.error.set('Failed to load verification status.');
          this.loading.set(false);
        },
      });
  }

  onFileSelect(event: Event, field: CnicField): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.error.set('Only JPEG and PNG images are allowed.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      this.error.set('File size must be less than 5MB.');
      return;
    }

    this.error.set('');
    this.setFile(field, file);

    const reader = new FileReader();
    reader.onload = () => this.setPreview(field, reader.result as string);
    reader.readAsDataURL(file);
  }

  get canSubmit(): boolean {
    return !!(
      this.cnicFrontFile &&
      this.cnicBackFile &&
      this.selfieFrontFile &&
      this.selfieBackFile &&
      !this.submitting()
    );
  }

  get showForm(): boolean {
    const v = this.verification();
    return (
      !v || v.status === IdVerificationStatus.NONE || v.status === IdVerificationStatus.REJECTED
    );
  }

  onSubmit(): void {
    if (!this.canSubmit) return;

    this.submitting.set(true);
    this.error.set('');
    this.success.set('');

    const formData = new FormData();
    formData.append('cnicFront', this.cnicFrontFile!);
    formData.append('cnicBack', this.cnicBackFile!);
    formData.append('selfieFront', this.selfieFrontFile!);
    formData.append('selfieBack', this.selfieBackFile!);

    this.http.post(`${this.apiUrl}${API.ID_VERIFICATION_SUBMIT}`, formData).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set('Verification request submitted successfully! We will review it shortly.');
        this.resetForm();
        this.loadStatus();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.message || 'Failed to submit verification request.');
      },
    });
  }

  removeFile(field: CnicField): void {
    this.setFile(field, null);
    this.setPreview(field, '');
  }

  private setFile(field: CnicField, file: File | null): void {
    switch (field) {
      case 'cnicFront':
        this.cnicFrontFile = file;
        break;
      case 'cnicBack':
        this.cnicBackFile = file;
        break;
      case 'selfieFront':
        this.selfieFrontFile = file;
        break;
      case 'selfieBack':
        this.selfieBackFile = file;
        break;
    }
  }

  private setPreview(field: CnicField, value: string): void {
    switch (field) {
      case 'cnicFront':
        this.cnicFrontPreview.set(value);
        break;
      case 'cnicBack':
        this.cnicBackPreview.set(value);
        break;
      case 'selfieFront':
        this.selfieFrontPreview.set(value);
        break;
      case 'selfieBack':
        this.selfieBackPreview.set(value);
        break;
    }
  }

  private resetForm(): void {
    (['cnicFront', 'cnicBack', 'selfieFront', 'selfieBack'] as CnicField[]).forEach((f) => {
      this.setFile(f, null);
      this.setPreview(f, '');
    });
  }
}
