import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { User } from '../../../core/models/user.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent implements OnInit {
  profileForm: FormGroup;
  user = signal<User | null>(null);
  loading = signal(false);
  saving = signal(false);
  editing = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  avatarPreview = signal<string | null>(null);

  private readonly apiUrl = environment.apiUrl;

  constructor(
    private readonly fb: FormBuilder,
    public readonly authService: AuthService,
    private readonly http: HttpClient,
  ) {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      city: ['', [Validators.maxLength(100)]],
      postalCode: ['', [Validators.maxLength(20)]],
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.authService.fetchCurrentUser().subscribe({
      next: (user) => {
        this.user.set(user);
        this.populateForm(user);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load profile.');
        this.loading.set(false);
      },
    });
  }

  populateForm(user: User): void {
    this.profileForm.patchValue({
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
      city: user.profile.city || '',
      postalCode: user.profile.postalCode || '',
    });
    if (user.profile.avatar) {
      this.avatarPreview.set(user.profile.avatar);
    }
  }

  toggleEdit(): void {
    this.editing.update((v) => !v);
    this.successMessage.set('');
    this.errorMessage.set('');
    if (!this.editing()) {
      const currentUser = this.user();
      if (currentUser) {
        this.populateForm(currentUser);
      }
    }
  }

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        this.errorMessage.set('Please select a JPEG, PNG, or WebP image.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage.set('Image must be under 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const payload = {
      profile: {
        firstName: this.profileForm.value.firstName,
        lastName: this.profileForm.value.lastName,
        city: this.profileForm.value.city,
        postalCode: this.profileForm.value.postalCode,
      },
    };

    this.http.patch<User>(`${this.apiUrl}/users/me`, payload).subscribe({
      next: (updatedUser) => {
        this.user.set(updatedUser);
        this.authService.setUser(updatedUser);
        this.saving.set(false);
        this.editing.set(false);
        this.successMessage.set('Profile updated successfully.');
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to update profile.');
      },
    });
  }

  get initials(): string {
    const u = this.user();
    if (!u) return '';
    return (
      (u.profile.firstName?.charAt(0) || '') + (u.profile.lastName?.charAt(0) || '')
    ).toUpperCase();
  }
}
