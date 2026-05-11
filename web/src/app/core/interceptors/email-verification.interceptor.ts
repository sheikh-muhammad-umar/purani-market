import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { EmailVerificationModalService } from '../../shared/components/email-verification-modal/email-verification-modal.service';
import { PhoneVerificationModalService } from '../../shared/components/phone-verification-modal/phone-verification-modal.service';

const EMAIL_VERIFY_PHRASES = ['verify your email', 'email verification', 'email address to access'];

const PHONE_VERIFY_PHRASES = ['verify your phone', 'phone verification', 'phone number to access'];

function isEmailVerificationError(error: HttpErrorResponse): boolean {
  if (error.status !== 403) return false;
  const msg: string = (error.error?.message ?? '').toLowerCase();
  return EMAIL_VERIFY_PHRASES.some((phrase) => msg.includes(phrase));
}

function isPhoneVerificationError(error: HttpErrorResponse): boolean {
  if (error.status !== 403) return false;
  const msg: string = (error.error?.message ?? '').toLowerCase();
  return PHONE_VERIFY_PHRASES.some((phrase) => msg.includes(phrase));
}

export const emailVerificationInterceptor: HttpInterceptorFn = (req, next) => {
  const emailModal = inject(EmailVerificationModalService);
  const phoneModal = inject(PhoneVerificationModalService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isPhoneVerificationError(error)) {
        phoneModal.open();
      } else if (isEmailVerificationError(error)) {
        emailModal.open();
      }
      return throwError(() => error);
    }),
  );
};
