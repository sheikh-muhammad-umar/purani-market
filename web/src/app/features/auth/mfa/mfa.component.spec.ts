import { FormBuilder, Validators } from '@angular/forms';

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
