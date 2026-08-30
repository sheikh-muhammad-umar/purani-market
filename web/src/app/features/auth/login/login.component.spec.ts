import { FormBuilder, Validators } from '@angular/forms';
import { shouldOpenIdVerification } from './login.component';

describe('LoginComponent form logic', () => {
  const fb = new FormBuilder();

  function createLoginForm() {
    return fb.group({
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  it('should require email by default', () => {
    const form = createLoginForm();
    form.get('email')?.markAsTouched();
    expect(form.get('email')?.valid).toBe(false);
    expect(form.get('email')?.errors?.['required']).toBeTruthy();
  });

  it('should validate email format', () => {
    const form = createLoginForm();
    form.get('email')?.setValue('invalid-email');
    expect(form.get('email')?.errors?.['email']).toBeTruthy();
  });

  it('should accept valid email', () => {
    const form = createLoginForm();
    form.get('email')?.setValue('test@example.com');
    expect(form.get('email')?.valid).toBe(true);
  });

  it('should require password', () => {
    const form = createLoginForm();
    form.get('password')?.markAsTouched();
    expect(form.get('password')?.valid).toBe(false);
  });

  it('should require password minimum 8 characters', () => {
    const form = createLoginForm();
    form.get('password')?.setValue('short');
    expect(form.get('password')?.errors?.['minlength']).toBeTruthy();
  });

  it('should accept valid password', () => {
    const form = createLoginForm();
    form.get('password')?.setValue('password123');
    expect(form.get('password')?.valid).toBe(true);
  });

  it('should validate phone pattern when switching to phone mode', () => {
    const form = createLoginForm();
    // Simulate switching to phone mode
    form.get('email')?.clearValidators();
    form
      .get('phone')
      ?.setValidators([Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]);
    form.get('email')?.updateValueAndValidity();
    form.get('phone')?.updateValueAndValidity();

    form.get('phone')?.setValue('123');
    expect(form.get('phone')?.errors?.['pattern']).toBeTruthy();
  });

  it('should accept valid phone number', () => {
    const form = createLoginForm();
    form.get('email')?.clearValidators();
    form
      .get('phone')
      ?.setValidators([Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]);
    form.get('phone')?.updateValueAndValidity();

    form.get('phone')?.setValue('+923001234567');
    expect(form.get('phone')?.valid).toBe(true);
  });

  it('should be invalid when email and password are empty', () => {
    const form = createLoginForm();
    expect(form.valid).toBe(false);
  });

  it('should be valid with correct email and password', () => {
    const form = createLoginForm();
    form.get('email')?.setValue('test@example.com');
    form.get('password')?.setValue('password123');
    expect(form.valid).toBe(true);
  });
});

describe('shouldOpenIdVerification', () => {
  const opted = { wantsIdVerification: true, idVerified: false };

  it('should open the ID step for someone who asked for it at sign-up', () => {
    expect(shouldOpenIdVerification(opted, false)).toBe(true);
  });

  it('should not open it for someone who never asked', () => {
    expect(shouldOpenIdVerification({ wantsIdVerification: false, idVerified: false }, false)).toBe(
      false,
    );
  });

  it('should not open it once the user is already verified', () => {
    expect(shouldOpenIdVerification({ wantsIdVerification: true, idVerified: true }, false)).toBe(
      false,
    );
  });

  // Opting in should not mean being sent back here on every single sign-in.
  it('should not open it again on a device that was already offered it', () => {
    expect(shouldOpenIdVerification(opted, true)).toBe(false);
  });

  it('should tolerate a missing user', () => {
    expect(shouldOpenIdVerification(null, false)).toBe(false);
    expect(shouldOpenIdVerification(undefined, false)).toBe(false);
  });

  // The field is optional on the model, so an older response must not redirect.
  it('should not open it when the flag is absent', () => {
    expect(shouldOpenIdVerification({ idVerified: false } as any, false)).toBe(false);
  });
});
