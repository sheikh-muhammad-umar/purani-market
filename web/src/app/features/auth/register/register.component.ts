import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  registerForm: FormGroup;
  usePhone = signal(false);
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.registerForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.maxLength(50)]],
        lastName: ['', [Validators.required, Validators.maxLength(50)]],
        email: ['', [Validators.required, Validators.email]],
        phone: [''],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  toggleRegistrationMethod(): void {
    this.usePhone.update(v => !v);
    this.registerForm.get('email')?.reset();
    this.registerForm.get('phone')?.reset();
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.usePhone()) {
      this.registerForm.get('email')?.clearValidators();
      this.registerForm
        .get('phone')
        ?.setValidators([Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]);
    } else {
      this.registerForm.get('phone')?.clearValidators();
      this.registerForm.get('email')?.setValidators([Validators.required, Validators.email]);
    }
    this.registerForm.get('email')?.updateValueAndValidity();
    this.registerForm.get('phone')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const formValue = this.registerForm.value;
    const data = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      password: formValue.password,
      ...(this.usePhone() ? { phone: formValue.phone } : { email: formValue.email }),
    };

    this.authService.register(data).subscribe({
      next: response => {
        this.loading.set(false);
        this.successMessage.set(
          response.message ||
            (this.usePhone()
              ? 'Registration successful! Please verify your phone number.'
              : 'Registration successful! Please check your email for verification.')
        );
      },
      error: err => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message || 'Registration failed. Please try again.');
      },
    });
  }

  onSocialLogin(provider: 'google' | 'facebook'): void {
    this.errorMessage.set(`${provider} login integration requires OAuth setup.`);
  }
}
