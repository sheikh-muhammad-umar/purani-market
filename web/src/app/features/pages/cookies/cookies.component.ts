import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [RouterLink],
  styleUrls: ['../pages.scss'],
  template: `
    <div class="static-page">
      <h1>Cookie Policy</h1>
      <p class="page-subtitle">
        This policy explains how Marketplace.pk uses cookies and similar technologies.
      </p>

      <h2>1. What Are Cookies</h2>
      <p>
        Cookies are small text files that are placed on your device (computer, tablet, or mobile
        phone) when you visit a website. They are widely used to make websites work more
        efficiently, provide a better user experience, and supply information to the website
        operators. Cookies may be "session" cookies (which are deleted when you close your browser)
        or "persistent" cookies (which remain on your device for a set period or until you delete
        them). This Cookie Policy should be read alongside our
        <a routerLink="/privacy">Privacy Policy</a> and <a routerLink="/terms">Terms of Service</a>.
      </p>

      <h2>2. Types of Cookies We Use</h2>

      <h3>2.1 Essential Cookies</h3>
      <p>
        These cookies are strictly necessary for the operation of the Platform. They enable core
        functionality such as user authentication, session management, and security features.
        Without these cookies, the Platform cannot function properly. These cookies do not require
        your consent.
      </p>
      <ul>
        <li>
          <strong>session_token</strong> — Maintains your authenticated session while you are logged
          in. This cookie is essential for keeping you signed in as you navigate between pages.
          Duration: session (deleted when browser is closed).
        </li>
      </ul>

      <h3>2.2 Preference Cookies</h3>
      <p>
        These cookies allow the Platform to remember choices you have made, such as your preferred
        language or display settings, to provide a more personalized experience.
      </p>
      <ul>
        <li>
          <strong>theme_preference</strong> — Stores your selected theme (light or dark mode) so the
          Platform displays in your preferred appearance. Duration: 1 year.
        </li>
        <li>
          <strong>language</strong> — Stores your preferred language setting (e.g., English, Urdu)
          so content is displayed in your chosen language. Duration: 1 year.
        </li>
      </ul>

      <h3>2.3 Analytics Cookies</h3>
      <p>
        These cookies help us understand how visitors interact with the Platform by collecting and
        reporting information anonymously. This data helps us improve the Platform's performance and
        user experience.
      </p>
      <ul>
        <li>
          <strong>analytics_id</strong> — A unique identifier used to distinguish users for
          analytics purposes. This helps us understand usage patterns, popular features, and areas
          for improvement. Duration: 2 years.
        </li>
      </ul>

      <h3>2.4 Marketing Cookies</h3>
      <p>
        These cookies may be used to deliver advertisements that are relevant to your interests.
        They may also be used to limit the number of times you see an advertisement and to measure
        the effectiveness of advertising campaigns. Marketing cookies are set by us or by
        third-party advertising partners.
      </p>

      <h2>3. Third-Party Cookies</h2>
      <p>
        In addition to our own cookies, we may use cookies set by third-party services to help us
        analyze Platform usage and performance. These third-party cookies are governed by the
        respective privacy policies of those third parties.
      </p>
      <ul>
        <li>
          <strong>Google Analytics</strong> — We use Google Analytics to collect anonymized data
          about how users interact with the Platform, including pages visited, time spent on pages,
          and navigation paths. Google Analytics sets its own cookies (e.g., <code>_ga</code>,
          <code>_gid</code>) to distinguish users and throttle request rates. For more information,
          see
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"
            >Google's Privacy Policy</a
          >.
        </li>
      </ul>

      <h2>4. How to Manage Cookies</h2>
      <p>
        Most web browsers allow you to control cookies through their settings. You can typically
        find these settings in the "Options", "Settings", or "Preferences" menu of your browser. The
        following links provide instructions for managing cookies in common browsers:
      </p>
      <ul>
        <li>Google Chrome: Settings &gt; Privacy and Security &gt; Cookies and other site data</li>
        <li>Mozilla Firefox: Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
        <li>Safari: Preferences &gt; Privacy &gt; Manage Website Data</li>
        <li>
          Microsoft Edge: Settings &gt; Cookies and site permissions &gt; Manage and delete cookies
          and site data
        </li>
      </ul>
      <p>
        You may also opt out of Google Analytics tracking by installing the
        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer"
          >Google Analytics Opt-out Browser Add-on</a
        >.
      </p>

      <h2>5. Impact of Disabling Cookies</h2>
      <p>
        If you choose to disable or block cookies, please be aware that some features of the
        Platform may not function properly. Specifically:
      </p>
      <ul>
        <li>
          Disabling essential cookies will prevent you from logging in and using authenticated
          features of the Platform.
        </li>
        <li>
          Disabling preference cookies will reset your theme and language settings to defaults on
          each visit.
        </li>
        <li>
          Disabling analytics cookies will not affect your use of the Platform but will limit our
          ability to improve the service based on usage data.
        </li>
        <li>
          Disabling marketing cookies will not affect your use of the Platform but may result in
          less relevant advertisements.
        </li>
      </ul>

      <h2>6. Changes to This Cookie Policy</h2>
      <p>
        We may update this Cookie Policy from time to time to reflect changes in the cookies we use,
        changes in technology, or changes in applicable law. We will notify you of any material
        changes by posting the updated policy on the Platform and updating the "Last updated" date.
        We encourage you to review this Cookie Policy periodically.
      </p>

      <h2>7. Contact Information</h2>
      <p>
        If you have any questions about our use of cookies or this Cookie Policy, please contact us
        at:
      </p>
      <ul>
        <li>Email: <a href="mailto:privacy&#64;marketplace.pk">privacy&#64;marketplace.pk</a></li>
      </ul>

      <p>
        <em>
          Note: This document is a template and is provided for informational purposes only. It does
          not constitute legal advice. We strongly recommend that you consult with a qualified legal
          professional before relying on this policy.
        </em>
      </p>

      <p class="last-updated">Last updated: January 2025</p>
    </div>
  `,
})
export class CookiesComponent {}
