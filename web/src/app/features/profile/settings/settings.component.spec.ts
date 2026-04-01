import { FormBuilder, Validators } from '@angular/forms';

describe('SettingsComponent form logic', () => {
  const fb = new FormBuilder();

  function createEmailForm() {
    return fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
    });
  }

  function createPhoneForm() {
    return fb.group({
      newPhone: ['', [Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]],
    });
  }

  function createOtpForm() {
    return fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  // Email form tests
  describe('Email change form', () => {
    it('should require new email', () => {
      const form = createEmailForm();
      form.get('newEmail')?.markAsTouched();
      expect(form.get('newEmail')?.valid).toBe(false);
      expect(form.get('newEmail')?.errors?.['required']).toBeTruthy();
    });

    it('should validate email format', () => {
      const form = createEmailForm();
      form.get('newEmail')?.setValue('not-an-email');
      expect(form.get('newEmail')?.errors?.['email']).toBeTruthy();
    });

    it('should accept valid email', () => {
      const form = createEmailForm();
      form.get('newEmail')?.setValue('new@example.com');
      expect(form.get('newEmail')?.valid).toBe(true);
    });
  });

  // Phone form tests
  describe('Phone change form', () => {
    it('should require new phone', () => {
      const form = createPhoneForm();
      form.get('newPhone')?.markAsTouched();
      expect(form.get('newPhone')?.valid).toBe(false);
      expect(form.get('newPhone')?.errors?.['required']).toBeTruthy();
    });

    it('should reject invalid phone number', () => {
      const form = createPhoneForm();
      form.get('newPhone')?.setValue('123');
      expect(form.get('newPhone')?.errors?.['pattern']).toBeTruthy();
    });

    it('should accept valid phone number', () => {
      const form = createPhoneForm();
      form.get('newPhone')?.setValue('+923001234567');
      expect(form.get('newPhone')?.valid).toBe(true);
    });

    it('should accept phone without plus prefix', () => {
      const form = createPhoneForm();
      form.get('newPhone')?.setValue('923001234567');
      expect(form.get('newPhone')?.valid).toBe(true);
    });
  });

  // OTP form tests
  describe('OTP verification form', () => {
    it('should require OTP', () => {
      const form = createOtpForm();
      form.get('otp')?.markAsTouched();
      expect(form.get('otp')?.valid).toBe(false);
      expect(form.get('otp')?.errors?.['required']).toBeTruthy();
    });

    it('should reject non-6-digit OTP', () => {
      const form = createOtpForm();
      form.get('otp')?.setValue('123');
      expect(form.get('otp')?.errors?.['pattern']).toBeTruthy();
    });

    it('should reject OTP with letters', () => {
      const form = createOtpForm();
      form.get('otp')?.setValue('12ab56');
      expect(form.get('otp')?.errors?.['pattern']).toBeTruthy();
    });

    it('should accept valid 6-digit OTP', () => {
      const form = createOtpForm();
      form.get('otp')?.setValue('123456');
      expect(form.get('otp')?.valid).toBe(true);
    });
  });
});
