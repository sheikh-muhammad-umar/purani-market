import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth';

export const CHATBOT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./chatbot-widget/chatbot-widget.component').then((m) => m.ChatbotWidgetComponent),
  },
];
