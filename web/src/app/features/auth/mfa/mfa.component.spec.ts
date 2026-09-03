import { FormBuilder, Validators } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { MfaComponent } from './mfa.component';
import { AuthService } from '../../../core/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTES } from '../../../core/constants/routes';

describe('MfaComponent form logic', () => {
  const fb = new FormBuilder();

  function createMfaForm() {
    return fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  it('should require code', () => {
    const form = createMfaForm();
    form.get('code')?.markAsTouched();
    expect(form.get('code')?.valid).toBe(false);
    expect(form.get('code')?.errors?.['required']).toBeTruthy();
  });

  it('should reject non-6-digit code', () => {
    const form = createMfaForm();
    form.get('code')?.setValue('123');
    expect(form.get('code')?.errors?.['pattern']).toBeTruthy();
  });

  it('should reject alphabetic code', () => {
    const form = createMfaForm();
    form.get('code')?.setValue('abcdef');
    expect(form.get('code')?.errors?.['pattern']).toBeTruthy();
  });

  it('should accept valid 6-digit code', () => {
    const form = createMfaForm();
    form.get('code')?.setValue('123456');
    expect(form.get('code')?.valid).toBe(true);
  });

  it('should reject 7-digit code', () => {
    const form = createMfaForm();
    form.get('code')?.setValue('1234567');
    expect(form.get('code')?.errors?.['pattern']).toBeTruthy();
  });
});

describe('MfaComponent behaviour', () => {
  let authService: {
    enableMfa: ReturnType<typeof vi.fn>;
    confirmMfa: ReturnType<typeof vi.fn>;
    verifyMfa: ReturnType<typeof vi.fn>;
    disableMfa: ReturnType<typeof vi.fn>;
    storeTokens: ReturnType<typeof vi.fn>;
    fetchCurrentUser: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  /** Builds the component with the given query string. */
  function create(params: Record<string, string>) {
    authService = {
      enableMfa: vi.fn().mockReturnValue(of({ qrCodeUrl: 'data:image/png;base64,x', secret: 'S' })),
      confirmMfa: vi.fn().mockReturnValue(of({ message: 'ok' })),
      verifyMfa: vi.fn().mockReturnValue(of({ accessToken: 'access', refreshToken: 'refresh' })),
      disableMfa: vi.fn().mockReturnValue(of({ message: 'ok' })),
      storeTokens: vi.fn(),
      fetchCurrentUser: vi.fn().mockReturnValue(of({ id: 'u1' })),
    };
    router = { navigate: vi.fn() };

    const route = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => params[key] ?? null,
        },
      },
    };

    const component = new MfaComponent(
      new FormBuilder(),
      authService as unknown as AuthService,
      route as unknown as ActivatedRoute,
      router as unknown as Router,
    );
    component.ngOnInit();
    return component;
  }

  describe('login verification', () => {
    it('should exchange the ticket from the query string, not a user id', () => {
      const component = create({ token: 'mfa-ticket-jwt' });

      component.mfaForm.setValue({ code: '123456' });
      component.onSubmit();

      expect(authService.verifyMfa).toHaveBeenCalledWith('mfa-ticket-jwt', '123456');
      expect(authService.storeTokens).toHaveBeenCalledWith({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
    });

    it('should tell the user to sign in again when no ticket was passed', () => {
      const component = create({});
      expect(component.errorMessage()).toContain('log in again');
    });

    it('should surface a failed code without storing tokens', () => {
      const component = create({ token: 'mfa-ticket-jwt' });
      authService.verifyMfa.mockReturnValue(throwError(() => ({ status: 401 })));

      component.mfaForm.setValue({ code: '000000' });
      component.onSubmit();

      expect(component.errorMessage()).toBeTruthy();
      expect(authService.storeTokens).not.toHaveBeenCalled();
    });
  });

  describe('setup', () => {
    it('should fetch the QR code on entry', () => {
      const component = create({ setup: 'true' });

      expect(authService.enableMfa).toHaveBeenCalled();
      expect(component.setupData()?.secret).toBe('S');
    });

    it('should confirm setup against the confirm endpoint', () => {
      // The bug this pins: setup mode used to post the literal string 'setup' to
      // the login verification endpoint, which no route understood.
      const component = create({ setup: 'true' });

      component.mfaForm.setValue({ code: '123456' });
      component.onSubmit();

      expect(authService.confirmMfa).toHaveBeenCalledWith('123456');
      expect(authService.verifyMfa).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith([ROUTES.PROFILE], {
        queryParams: { mfa: 'enabled' },
      });
    });

    it('should not navigate away when the code is rejected', () => {
      const component = create({ setup: 'true' });
      authService.confirmMfa.mockReturnValue(throwError(() => ({ status: 401 })));
      router.navigate.mockClear();

      component.mfaForm.setValue({ code: '000000' });
      component.onSubmit();

      expect(component.errorMessage()).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('disable', () => {
    it('should ask for a password rather than a code', () => {
      const component = create({ disable: 'true' });

      expect(component.isDisableMode()).toBe(true);
      expect(component.disableForm.get('password')).toBeTruthy();
    });

    it('should send the password to the disable endpoint', () => {
      const component = create({ disable: 'true' });

      component.disableForm.setValue({ password: 'password123' });
      component.onDisableSubmit();

      expect(authService.disableMfa).toHaveBeenCalledWith('password123');
      expect(router.navigate).toHaveBeenCalledWith([ROUTES.PROFILE], {
        queryParams: { mfa: 'disabled' },
      });
    });

    it('should not submit an empty password', () => {
      const component = create({ disable: 'true' });

      component.onDisableSubmit();

      expect(authService.disableMfa).not.toHaveBeenCalled();
    });

    it('should report a wrong password distinctly', () => {
      const component = create({ disable: 'true' });
      authService.disableMfa.mockReturnValue(throwError(() => ({ status: 401 })));

      component.disableForm.setValue({ password: 'wrong' });
      component.onDisableSubmit();

      expect(component.errorMessage()).toContain('password');
    });
  });
});
