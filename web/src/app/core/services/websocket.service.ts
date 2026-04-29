import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { WS_RECONNECTION_ATTEMPTS, WS_RECONNECTION_DELAY_MS } from '../constants/app';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly messages$ = new Subject<{ event: string; data: unknown }>();
  private connectedUserId: string | null = null;

  constructor(private readonly authService: AuthService) {}

  connect(userId: string): void {
    if (!userId) return;
    if (this.socket && this.connectedUserId === userId) return;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    const token = this.authService.getAccessToken();
    if (!token) return;

    this.connectedUserId = userId;
    const baseUrl = environment.wsUrl.replace(/^ws/, 'http');

    this.socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: WS_RECONNECTION_ATTEMPTS,
      reconnectionDelay: WS_RECONNECTION_DELAY_MS,
    });

    this.socket.onAny((event: string, data: unknown) => {
      this.messages$.next({ event, data });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connectedUserId = null;
  }

  send(event: string, data: unknown): void {
    this.socket?.emit(event, data);
  }

  on(event: string): Observable<unknown> {
    return new Observable((subscriber) => {
      const sub = this.messages$.subscribe((msg) => {
        if (msg.event === event) {
          subscriber.next(msg.data);
        }
      });
      return () => sub.unsubscribe();
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messages$.complete();
  }
}
