import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth';

export const MESSAGING_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./conversation-list/conversation-list.component').then(m => m.ConversationListComponent),
  },
  {
    path: ':id',
    canActivate: [authGuard],
    loadComponent: () => import('./chat-window/chat-window.component').then(m => m.ChatWindowComponent),
  },
];
