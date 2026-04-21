import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterLink, FormsModule],
  styleUrl: '../pages.scss',
  template: `
    <div class="static-page">
      <h1>Contact Us</h1>
      <p class="page-subtitle">
        Have a question, concern, or feedback? We'd love to hear from you. Reach out through any of
        the channels below.
      </p>

      <h2>Get in Touch</h2>
      <div class="card-grid">
        <div class="info-card">
          <h3>✉️ Email</h3>
          <p><a href="mailto:support&#64;marketplace.pk">support&#64;marketplace.pk</a></p>
          <p>For general enquiries, account issues, and listing support.</p>
        </div>
        <div class="info-card">
          <h3>📞 Phone</h3>
          <p><strong>0800-XXXXX</strong></p>
          <p>Toll-free helpline available during working hours.</p>
        </div>
        <div class="info-card">
          <h3>🏢 Office</h3>
          <p>Lahore, Punjab, Pakistan</p>
          <p>Visits by appointment only.</p>
        </div>
        <div class="info-card">
          <h3>🕘 Working Hours</h3>
          <p>Monday – Saturday</p>
          <p>9:00 AM – 6:00 PM PKT</p>
        </div>
      </div>

      <h2>Send Us a Message</h2>
      <p>
        Fill out the form below and our support team will get back to you within
        <strong>24–48 hours</strong>.
      </p>

      <form class="contact-form" (ngSubmit)="onSubmit()">
        <input
          type="text"
          placeholder="Your Name"
          [(ngModel)]="form.name"
          name="name"
          required
          aria-label="Your Name"
        />
        <input
          type="email"
          placeholder="Your Email"
          [(ngModel)]="form.email"
          name="email"
          required
          aria-label="Your Email"
        />
        <select [(ngModel)]="form.subject" name="subject" required aria-label="Subject">
          <option value="" disabled>Select a subject</option>
          <option value="general">General Enquiry</option>
          <option value="bug">Bug Report</option>
          <option value="account">Account Issue</option>
          <option value="listing">Listing Issue</option>
          <option value="payment">Payment Issue</option>
          <option value="other">Other</option>
        </select>
        <textarea
          placeholder="Your Message"
          [(ngModel)]="form.message"
          name="message"
          required
          aria-label="Your Message"
        ></textarea>
        <button type="submit" class="btn-submit">Send Message</button>
      </form>

      @if (submitted) {
        <p style="margin-top: var(--space-2); color: var(--success);">
          ✅ Thank you! Your message has been sent. We'll respond within 24–48 hours.
        </p>
      }

      <h2>Connect With Us</h2>
      <div class="card-grid">
        <div class="info-card">
          <h3>Facebook</h3>
          <p><a href="#" target="_blank" rel="noopener">facebook.com/marketplace.pk</a></p>
        </div>
        <div class="info-card">
          <h3>Twitter / X</h3>
          <p><a href="#" target="_blank" rel="noopener">&#64;marketplace_pk</a></p>
        </div>
        <div class="info-card">
          <h3>Instagram</h3>
          <p><a href="#" target="_blank" rel="noopener">&#64;marketplace.pk</a></p>
        </div>
      </div>

      <h2>Other Resources</h2>
      <ul>
        <li>
          <a routerLink="/trust-safety">Trust &amp; Safety</a> — learn how we keep the platform
          secure
        </li>
        <li><a routerLink="/selling-tips">Selling Tips</a> — get the best price for your items</li>
        <li><a routerLink="/terms">Terms of Service</a> — our platform rules and policies</li>
        <li><a routerLink="/privacy">Privacy Policy</a> — how we handle your data</li>
      </ul>

      <p class="last-updated">Last updated: June 2025</p>
    </div>
  `,
})
export class ContactComponent {
  form = {
    name: '',
    email: '',
    subject: '',
    message: '',
  };

  submitted = false;

  onSubmit() {
    this.submitted = true;
  }
}
