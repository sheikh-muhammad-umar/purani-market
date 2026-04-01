import { FormBuilder, Validators } from '@angular/forms';

describe('UserProfileComponent form logic', () => {
  const fb = new FormBuilder();

  function createProfileForm() {
    return fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      city: ['', [Validators.maxLength(100)]],
      postalCode: ['', [Validators.maxLength(20)]],
    });
  }

  it('should require first name', () => {
    const form = createProfileForm();
    form.get('firstName')?.markAsTouched();
    expect(form.get('firstName')?.valid).toBe(false);
    expect(form.get('firstName')?.errors?.['required']).toBeTruthy();
  });

  it('should require last name', () => {
    const form = createProfileForm();
    form.get('lastName')?.markAsTouched();
    expect(form.get('lastName')?.valid).toBe(false);
    expect(form.get('lastName')?.errors?.['required']).toBeTruthy();
  });

  it('should enforce first name max length of 50', () => {
    const form = createProfileForm();
    form.get('firstName')?.setValue('a'.repeat(51));
    expect(form.get('firstName')?.errors?.['maxlength']).toBeTruthy();
  });

  it('should enforce last name max length of 50', () => {
    const form = createProfileForm();
    form.get('lastName')?.setValue('a'.repeat(51));
    expect(form.get('lastName')?.errors?.['maxlength']).toBeTruthy();
  });

  it('should accept valid first and last name', () => {
    const form = createProfileForm();
    form.get('firstName')?.setValue('John');
    form.get('lastName')?.setValue('Doe');
    expect(form.get('firstName')?.valid).toBe(true);
    expect(form.get('lastName')?.valid).toBe(true);
  });

  it('should allow empty city and postal code', () => {
    const form = createProfileForm();
    form.get('firstName')?.setValue('John');
    form.get('lastName')?.setValue('Doe');
    expect(form.valid).toBe(true);
  });

  it('should enforce city max length of 100', () => {
    const form = createProfileForm();
    form.get('city')?.setValue('a'.repeat(101));
    expect(form.get('city')?.errors?.['maxlength']).toBeTruthy();
  });

  it('should enforce postal code max length of 20', () => {
    const form = createProfileForm();
    form.get('postalCode')?.setValue('a'.repeat(21));
    expect(form.get('postalCode')?.errors?.['maxlength']).toBeTruthy();
  });

  it('should be valid with all fields filled correctly', () => {
    const form = createProfileForm();
    form.patchValue({
      firstName: 'John',
      lastName: 'Doe',
      city: 'Lahore',
      postalCode: '54000',
    });
    expect(form.valid).toBe(true);
  });

  it('should be invalid when first name is empty', () => {
    const form = createProfileForm();
    form.patchValue({ firstName: '', lastName: 'Doe' });
    expect(form.valid).toBe(false);
  });
});
