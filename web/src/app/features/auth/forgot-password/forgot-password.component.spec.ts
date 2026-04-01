import { FormBuilder, Validators } from '@angular/forms';

describe('ForgotPasswordComponent form logic', () => {
  const fb = new FormBuilder();

  function createForgotForm() {
    return fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  it('should require email', () => {
    const form = createForgotForm();
    form.get('email')?.markAsTouched();
    expect(form.get('email')?.valid).toBe(false);
    expect(form.get('email')?.errors?.['required']).toBeTruthy();
  });

  it('should validate email format', () => {
    const form = createForgotForm();
    form.get('email')?.setValue('not-an-email');
    expect(form.get('email')?.errors?.['email']).toBeTruthy();
  });

  it('should accept valid email', () => {
    const form = createForgotForm();
    form.get('email')?.setValue('test@example.com');
    expect(form.get('email')?.valid).toBe(true);
  });

  it('should be invalid when email is empty', () => {
    const form = createForgotForm();
    expect(form.valid).toBe(false);
  });

  it('should be valid with correct email', () => {
    const form = createForgotForm();
    form.get('email')?.setValue('user@domain.com');
    expect(form.valid).toBe(true);
  });
});
