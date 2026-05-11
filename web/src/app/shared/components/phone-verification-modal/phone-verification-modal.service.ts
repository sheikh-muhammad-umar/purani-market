import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PhoneVerificationModalService {
  readonly isOpen = signal(false);

  private readonly verified$ = new Subject<void>();
  /** Emits once when the user successfully verifies their phone */
  readonly onVerified$ = this.verified$.asObservable();

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  notifyVerified(): void {
    this.isOpen.set(false);
    this.verified$.next();
  }
}
