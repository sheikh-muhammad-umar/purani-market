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

describe('RegisterComponent form logic', () => {
  const fb = new FormBuilder();

  function createRegisterForm() {
    return fb.group(
      {
        firstName: ['', [Validators.required, Validators.maxLength(50)]],
        lastName: ['', [Validators.required, Validators.maxLength(50)]],
        email: ['', [Validators.required, Validators.email]],
        phone: [''],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator }
    );
  }

  it('should require first name', () => {
    const form = createRegisterForm();
    form.get('firstName')?.markAsTouched();
    expect(form.get('firstName')?.valid).toBe(false);
  });

  it('should require last name', () => {
    const form = createRegisterForm();
    form.get('lastName')?.markAsTouched();
    expect(form.get('lastName')?.valid).toBe(false);
  });

  it('should require email', () => {
    const form = createRegisterForm();
    form.get('email')?.markAsTouched();
    expect(form.get('email')?.valid).toBe(false);
  });

  it('should validate email format', () => {
    const form = createRegisterForm();
    form.get('email')?.setValue('bad-email');
    expect(form.get('email')?.errors?.['email']).toBeTruthy();
  });

  it('should require password minimum 8 characters', () => {
    const form = createRegisterForm();
    form.get('password')?.setValue('short');
    expect(form.get('password')?.errors?.['minlength']).toBeTruthy();
  });

  it('should detect password mismatch', () => {
    const form = createRegisterForm();
    form.get('password')?.setValue('password123');
    form.get('confirmPassword')?.setValue('different');
    form.updateValueAndValidity();
    expect(form.get('confirmPassword')?.errors?.['passwordMismatch']).toBeTruthy();
  });

  it('should accept matching passwords', () => {
    const form = createRegisterForm();
    form.get('password')?.setValue('password123');
    form.get('confirmPassword')?.setValue('password123');
    form.updateValueAndValidity();
    expect(form.get('confirmPassword')?.errors).toBeNull();
  });

  it('should validate phone pattern in phone mode', () => {
    const form = createRegisterForm();
    form.get('email')?.clearValidators();
    form.get('phone')?.setValidators([Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]);
    form.get('phone')?.updateValueAndValidity();

    form.get('phone')?.setValue('abc');
    expect(form.get('phone')?.errors?.['pattern']).toBeTruthy();
  });

  it('should enforce first name max length of 50', () => {
    const form = createRegisterForm();
    form.get('firstName')?.setValue('a'.repeat(51));
    expect(form.get('firstName')?.errors?.['maxlength']).toBeTruthy();
  });

  it('should be valid with all correct fields', () => {
    const form = createRegisterForm();
    form.get('firstName')?.setValue('John');
    form.get('lastName')?.setValue('Doe');
    form.get('email')?.setValue('john@example.com');
    form.get('password')?.setValue('password123');
    form.get('confirmPassword')?.setValue('password123');
    form.updateValueAndValidity();
    expect(form.valid).toBe(true);
  });
});
