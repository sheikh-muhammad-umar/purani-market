import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./user-profile/user-profile.component').then((m) => m.UserProfileComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./notification-prefs/notification-prefs.component').then(
        (m) => m.NotificationPrefsComponent,
      ),
  },
];
