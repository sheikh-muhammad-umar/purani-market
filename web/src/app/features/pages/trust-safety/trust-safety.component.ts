import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-trust-safety',
  standalone: true,
  imports: [RouterLink],
  styleUrl: '../pages.scss',
  template: `
    <div class="static-page">
      <h1>Trust &amp; Safety</h1>
      <p class="page-subtitle">Your safety is our top priority. Learn how we keep our marketplace secure for everyone in Pakistan.</p>

      <h2>How We Verify Users</h2>
      <div class="card-grid">
        <div class="info-card">
          <h3>📱 Phone Verification</h3>
          <p>Every user must verify their Pakistani mobile number via OTP before posting ads. This ensures accountability and helps us trace fraudulent activity.</p>
        </div>
        <div class="info-card">
          <h3>✉️ Email Verification</h3>
          <p>A verified email address is required for account recovery, notifications, and an added layer of identity confirmation.</p>
        </div>
        <div class="info-card">
          <h3>🛡️ Profile Trust Score</h3>
          <p>Verified phone, email, and a complete profile increase your trust score, giving buyers more confidence when dealing with you.</p>
        </div>
      </div>

      <h2>Safe Trading Tips</h2>
      <ul>
        <li><strong>Meet in public places</strong> — always conduct transactions in busy, well-lit areas such as shopping malls, bank branches, or police station parking lots.</li>
        <li><strong>Never share your CNIC or bank details</strong> — legitimate buyers and sellers will never ask for your CNIC number, PIN codes, or online banking credentials.</li>
        <li><strong>Use in-app messaging</strong> — keep all communication within our platform so we can assist you if a dispute arises.</li>
        <li><strong>Inspect items before paying</strong> — always check the product thoroughly in person before handing over any money.</li>
        <li><strong>Avoid advance payments</strong> — never send money upfront to someone you haven't met, especially via untraceable methods.</li>
        <li><strong>Bring a friend</strong> — when meeting for high-value transactions, take someone along for added safety.</li>
      </ul>

      <h2>Fraud Prevention</h2>
      <h3>How to Spot Scams</h3>
      <ul>
        <li>Prices that seem too good to be true — if a brand-new iPhone is listed for Rs. 5,000, it's almost certainly a scam.</li>
        <li>Sellers who pressure you to pay immediately or ask for advance payments via EasyPaisa/JazzCash before meeting.</li>
        <li>Requests to move the conversation off-platform to WhatsApp or other messaging apps.</li>
        <li>Listings with stock photos instead of real pictures of the actual item.</li>
        <li>Sellers who refuse to meet in person or insist on courier-only delivery for local transactions.</li>
      </ul>

      <h3>What to Do If You've Been Scammed</h3>
      <ul>
        <li>Report the user and listing immediately through our <strong>Report</strong> button.</li>
        <li>Contact our support team at <strong>support&#64;marketplace.pk</strong> with all relevant details and screenshots.</li>
        <li>File a complaint with the <strong>FIA Cyber Crime Wing</strong> at <a href="https://complaint.fia.gov.pk" target="_blank" rel="noopener">complaint.fia.gov.pk</a> or call the helpline <strong>9911</strong>.</li>
        <li>If money was transferred, contact your bank or mobile wallet provider immediately to attempt a reversal.</li>
      </ul>

      <h2>Reporting Suspicious Activity</h2>
      <p>If you encounter a suspicious listing or user, you can report them directly from their profile or listing page using the <strong>Report</strong> button. Our moderation team reviews all reports within 24 hours. You can also reach us at <a routerLink="/contact">Contact Us</a>.</p>
      <ul>
        <li>Fake or misleading listings</li>
        <li>Users requesting personal financial information</li>
        <li>Harassment or abusive behaviour</li>
        <li>Suspected stolen goods</li>
        <li>Price manipulation or bid shilling</li>
      </ul>

      <h2>Regulatory Compliance</h2>
      <p>We operate in full compliance with the <strong>Pakistan Telecommunication Authority (PTA)</strong> regulations and applicable e-commerce laws. Our platform adheres to data protection standards and cooperates with law enforcement agencies when required.</p>
      <p>For serious fraud or cybercrime, we work closely with the <strong>FIA Cyber Crime Wing</strong> to ensure offenders are held accountable under the Prevention of Electronic Crimes Act (PECA) 2016.</p>

      <h2>Prohibited Items</h2>
      <p>The following items are strictly prohibited on our platform. Listings found in violation will be removed immediately and the account may be permanently banned:</p>
      <ul>
        <li><strong>Weapons &amp; ammunition</strong> — firearms, knives, explosives, and related accessories</li>
        <li><strong>Drugs &amp; controlled substances</strong> — narcotics, prescription medication without licence, and drug paraphernalia</li>
        <li><strong>Counterfeit goods</strong> — fake branded items, replica electronics, and forged documents</li>
        <li><strong>Stolen property</strong> — any item obtained through theft or illegal means</li>
        <li><strong>Hazardous materials</strong> — chemicals, flammable substances, and toxic products</li>
        <li><strong>Adult content</strong> — pornographic material or services</li>
        <li><strong>Wildlife &amp; protected species</strong> — live animals, animal parts, or products from endangered species</li>
        <li><strong>Government-issued documents</strong> — CNICs, passports, licences, or any official identification</li>
      </ul>

      <p class="last-updated">Last updated: June 2025</p>
    </div>
  `
})
export class TrustSafetyComponent {}
