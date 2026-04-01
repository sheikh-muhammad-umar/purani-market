import { FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  if (password && confirmPassword && password.value !== confirmPassword.value) {
    confirmPassword.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }
  return null;
}

describe('ResetPasswordComponent form logic', () => {
  const fb = new FormBuilder();

  function createResetForm() {
    return fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator }
    );
  }

  it('should require password', () => {
    const form = createResetForm();
    form.get('password')?.markAsTouched();
    expect(form.get('password')?.valid).toBe(false);
    expect(form.get('password')?.errors?.['required']).toBeTruthy();
  });

  it('should require password minimum 8 characters', () => {
    const form = createResetForm();
    form.get('password')?.setValue('short');
    expect(form.get('password')?.errors?.['minlength']).toBeTruthy();
  });

  it('should accept valid password', () => {
    const form = createResetForm();
    form.get('password')?.setValue('newpass123');
    expect(form.get('password')?.valid).toBe(true);
  });

  it('should require confirm password', () => {
    const form = createResetForm();
    form.get('confirmPassword')?.markAsTouched();
    expect(form.get('confirmPassword')?.valid).toBe(false);
    expect(form.get('confirmPassword')?.errors?.['required']).toBeTruthy();
  });

  it('should detect password mismatch', () => {
    const form = createResetForm();
    form.get('password')?.setValue('newpass123');
    form.get('confirmPassword')?.setValue('different');
    form.updateValueAndValidity();
    expect(form.get('confirmPassword')?.errors?.['passwordMismatch']).toBeTruthy();
  });

  it('should accept matching passwords', () => {
    const form = createResetForm();
    form.get('password')?.setValue('newpass123');
    form.get('confirmPassword')?.setValue('newpass123');
    form.updateValueAndValidity();
    expect(form.get('confirmPassword')?.errors).toBeNull();
  });

  it('should be invalid when both fields are empty', () => {
    const form = createResetForm();
    expect(form.valid).toBe(false);
  });

  it('should be valid with matching passwords of sufficient length', () => {
    const form = createResetForm();
    form.get('password')?.setValue('securepass1');
    form.get('confirmPassword')?.setValue('securepass1');
    form.updateValueAndValidity();
    expect(form.valid).toBe(true);
  });
});
