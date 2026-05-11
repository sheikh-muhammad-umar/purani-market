import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EmailVerificationModalService {
  readonly isOpen = signal(false);

  /** Emits when the user successfully verifies their email */
  private readonly verified$ = new Subject<void>();
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
