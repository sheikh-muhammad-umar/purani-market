import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { User, NotificationPreferences } from '../../../core/models/user.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface NotificationToggle {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}

@Component({
  selector: 'app-notification-prefs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-prefs.component.html',
  styleUrl: './notification-prefs.component.scss',
})
export class NotificationPrefsComponent implements OnInit {
  user = signal<User | null>(null);
  loading = signal(false);
  saving = signal<string | null>(null);
  successMessage = signal('');
  errorMessage = signal('');

  readonly notificationToggles: NotificationToggle[] = [
    {
      key: 'messages',
      label: 'Messages',
      description: 'Get notified when you receive new messages from buyers or sellers.',
    },
    {
      key: 'offers',
      label: 'Offers',
      description: 'Receive notifications about new offers on your listings.',
    },
    {
      key: 'productUpdates',
      label: 'Product Updates',
      description: 'Get alerts when favorited products have price or status changes.',
    },
    {
      key: 'promotions',
      label: 'Promotions',
      description: 'Receive promotional offers and marketplace deals.',
    },
    {
      key: 'packageAlerts',
      label: 'Package Alerts',
      description: 'Get notified about package purchases, activations, and expirations.',
    },
  ];

  private readonly apiUrl = environment.apiUrl;

  constructor(
    private readonly authService: AuthService,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadUser();
  }

  loadUser(): void {
    this.loading.set(true);
    this.authService.fetchCurrentUser().subscribe({
      next: (user) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load notification preferences.');
        this.loading.set(false);
      },
    });
  }

  isEnabled(key: keyof NotificationPreferences): boolean {
    const u = this.user();
    if (!u?.notificationPreferences) return true;
    return u.notificationPreferences[key] ?? true;
  }

  onToggle(key: keyof NotificationPreferences): void {
    const currentUser = this.user();
    if (!currentUser) return;

    const currentValue = this.isEnabled(key);
    const newValue = !currentValue;

    // Optimistic update
    const updatedPrefs = {
      ...currentUser.notificationPreferences,
      [key]: newValue,
    };
    this.user.set({
      ...currentUser,
      notificationPreferences: updatedPrefs,
    });

    this.saving.set(key);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.http
      .patch<User>(`${this.apiUrl}/users/me`, {
        notificationPreferences: updatedPrefs,
      })
      .subscribe({
        next: (updatedUser) => {
          this.user.set(updatedUser);
          this.authService.setUser(updatedUser);
          this.saving.set(null);
          this.successMessage.set('Preference updated.');
          setTimeout(() => this.successMessage.set(''), 2000);
        },
        error: (err) => {
          // Revert optimistic update
          this.user.set(currentUser);
          this.saving.set(null);
          this.errorMessage.set(err.error?.message || 'Failed to update preference.');
        },
      });
  }
}
