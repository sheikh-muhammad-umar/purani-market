import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  styleUrls: ['../pages.scss'],
  template: `
    <div class="static-page">
      <h1>Privacy Policy</h1>
      <p class="page-subtitle">
        Your privacy is important to us. This policy explains how we collect, use, and protect your
        information.
      </p>

      <h2>1. Introduction</h2>
      <p>
        Marketplace.pk ("we", "us", or "our") is committed to protecting the privacy of our users.
        This Privacy Policy describes how we collect, use, disclose, and safeguard your personal
        information when you use our platform, in compliance with the Prevention of Electronic
        Crimes Act (PECA), 2016, the Pakistan Telecommunication (Re-organization) Act, 1996, and in
        anticipation of the Personal Data Protection Bill (currently pending legislation before the
        Parliament of Pakistan).
      </p>
      <p>
        By using the Platform, you consent to the collection and use of your information as
        described in this Privacy Policy. If you do not agree with the terms of this policy, please
        do not access or use the Platform.
      </p>

      <h2>2. Information We Collect</h2>
      <p>We collect the following categories of information:</p>

      <h3>2.1 Information You Provide</h3>
      <ul>
        <li>Full name, as provided during account registration.</li>
        <li>Email address, used for account verification, communication, and password recovery.</li>
        <li>Phone number, used for account verification and optional two-factor authentication.</li>
        <li>
          CNIC (Computerized National Identity Card) number, collected for identity verification
          purposes where required to ensure trust and safety on the Platform.
        </li>
        <li>
          Location information, including city and area, provided to enable location-based listing
          features.
        </li>
        <li>Profile information, including profile photo and bio, provided at your discretion.</li>
        <li>
          Listing content, including descriptions, images, and pricing information you submit.
        </li>
      </ul>

      <h3>2.2 Information Collected Automatically</h3>
      <ul>
        <li>
          Device information, including device type, operating system, browser type, and version.
        </li>
        <li>IP address and approximate geographic location derived from your IP address.</li>
        <li>
          Usage data, including pages visited, features used, search queries, and interaction
          patterns.
        </li>
        <li>
          Cookies and similar tracking technologies (see our
          <a routerLink="/cookies">Cookie Policy</a> for details).
        </li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>We use the information we collect for the following purposes:</p>
      <ul>
        <li>To provide, maintain, and improve the Platform and its features.</li>
        <li>
          To verify your identity and authenticate your account, including CNIC verification where
          applicable.
        </li>
        <li>
          To prevent fraud, abuse, and unauthorized access to the Platform, in accordance with PECA
          2016.
        </li>
        <li>To communicate with you regarding your account, transactions, and Platform updates.</li>
        <li>
          To personalize your experience, including providing relevant search results and
          recommendations.
        </li>
        <li>To process payments and manage billing for paid services.</li>
        <li>
          To comply with legal obligations and respond to lawful requests from government
          authorities.
        </li>
        <li>
          To analyze usage patterns and improve the overall quality and performance of the Platform.
        </li>
      </ul>

      <h2>4. Information Sharing and Disclosure</h2>
      <p>We may share your personal information in the following circumstances:</p>
      <ul>
        <li>With your explicit consent or at your direction.</li>
        <li>
          With other users of the Platform to the extent necessary to facilitate transactions (e.g.,
          sharing your phone number with a buyer when you approve contact).
        </li>
        <li>
          With third-party service providers who assist us in operating the Platform, processing
          payments, or providing customer support, subject to confidentiality obligations.
        </li>
        <li>
          With law enforcement agencies, regulatory authorities, or government bodies when required
          by law or in response to a valid legal process, including requests made under the
          Prevention of Electronic Crimes Act (PECA), 2016 and the Pakistan Telecommunication
          (Re-organization) Act, 1996.
        </li>
        <li>
          To protect the rights, property, or safety of Marketplace.pk, our users, or the public, as
          required or permitted by law.
        </li>
        <li>
          In connection with a merger, acquisition, or sale of all or a portion of our assets, in
          which case your information may be transferred to the acquiring entity.
        </li>
      </ul>

      <h2>5. Data Security</h2>
      <p>
        We implement appropriate technical and organizational measures to protect your personal
        information against unauthorized access, alteration, disclosure, or destruction. These
        measures include:
      </p>
      <ul>
        <li>Encryption of data in transit using TLS/SSL protocols.</li>
        <li>Encryption of sensitive data at rest.</li>
        <li>Secure server infrastructure with access controls and monitoring.</li>
        <li>Regular security assessments and vulnerability testing.</li>
        <li>Employee access controls and confidentiality agreements.</li>
      </ul>
      <p>
        While we strive to protect your personal information, no method of transmission over the
        Internet or method of electronic storage is completely secure. We cannot guarantee absolute
        security of your data.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain your personal information for as long as your account is active or as needed to
        provide you with our services. We may also retain and use your information as necessary to
        comply with our legal obligations, resolve disputes, and enforce our agreements. When your
        information is no longer required, we will securely delete or anonymize it in accordance
        with our data retention policies.
      </p>

      <h2>7. Your Rights</h2>
      <p>
        Subject to applicable law and the provisions of the Personal Data Protection Bill (pending
        legislation), you have the following rights regarding your personal information:
      </p>
      <ul>
        <li>
          Right of Access: You may request a copy of the personal information we hold about you.
        </li>
        <li>
          Right of Correction: You may request that we correct any inaccurate or incomplete personal
          information.
        </li>
        <li>
          Right of Deletion: You may request that we delete your personal information, subject to
          our legal obligations and legitimate business interests.
        </li>
        <li>
          Right to Withdraw Consent: Where processing is based on your consent, you may withdraw
          that consent at any time.
        </li>
      </ul>
      <p>
        To exercise any of these rights, please contact us at
        <a href="mailto:privacy&#64;marketplace.pk">privacy&#64;marketplace.pk</a>. We will respond
        to your request within a reasonable timeframe.
      </p>

      <h2>8. Children's Privacy</h2>
      <p>
        The Platform is not intended for use by individuals under the age of eighteen (18). We do
        not knowingly collect personal information from children under 18. If we become aware that
        we have collected personal information from a child under 18, we will take steps to delete
        such information promptly. If you believe that a child under 18 has provided us with
        personal information, please contact us immediately.
      </p>

      <h2>9. Third-Party Services</h2>
      <p>
        The Platform may contain links to third-party websites, services, or applications that are
        not operated by us. We have no control over and assume no responsibility for the content,
        privacy policies, or practices of any third-party services. We encourage you to review the
        privacy policies of any third-party services you access through the Platform.
      </p>

      <h2>10. Changes to This Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time to reflect changes in our practices,
        technology, legal requirements, or other factors. We will notify you of any material changes
        by posting the updated policy on the Platform and updating the "Last updated" date. We
        encourage you to review this Privacy Policy periodically. Your continued use of the Platform
        after any changes constitutes your acceptance of the updated policy.
      </p>

      <h2>11. Contact Information</h2>
      <p>
        If you have any questions, concerns, or requests regarding this Privacy Policy or our data
        practices, please contact us at:
      </p>
      <ul>
        <li>Email: <a href="mailto:privacy&#64;marketplace.pk">privacy&#64;marketplace.pk</a></li>
      </ul>

      <p>
        <em>
          Note: This document is a template and is provided for informational purposes only. It does
          not constitute legal advice. We strongly recommend that you consult with a qualified legal
          professional licensed to practice in Pakistan before relying on this policy.
        </em>
      </p>

      <p class="last-updated">Last updated: January 2025</p>
    </div>
  `,
})
export class PrivacyComponent {}
