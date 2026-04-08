import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoginModalService {
  readonly isOpen = signal(false);
  private redirectUrl: string | null = null;

  open(redirectAfterLogin?: string): void {
    this.redirectUrl = redirectAfterLogin ?? null;
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  getRedirectUrl(): string | null {
    return this.redirectUrl;
  }

  clearRedirect(): void {
    this.redirectUrl = null;
  }
}
