import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  styleUrls: ['../pages.scss'],
  template: `
    <div class="static-page">
      <h1>Terms of Service</h1>
      <p class="page-subtitle">Please read these terms carefully before using our platform.</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using the Marketplace.pk platform ("Platform"), including our website and
        mobile applications, you agree to be bound by these Terms of Service ("Terms"), our
        <a routerLink="/privacy">Privacy Policy</a>, and our
        <a routerLink="/cookies">Cookie Policy</a>. If you do not agree to these Terms, you must not
        access or use the Platform. Your continued use of the Platform following the posting of any
        changes to these Terms constitutes acceptance of those changes.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least eighteen (18) years of age to use this Platform. By using the Platform,
        you represent and warrant that you are competent to enter into a binding contract as defined
        under the Pakistan Contract Act, 1872 (Act IX of 1872). Persons who are disqualified from
        contracting under Section 11 of the Contract Act — including minors, persons of unsound
        mind, and persons otherwise disqualified by law — are not permitted to use this Platform.
      </p>

      <h2>3. Account Registration</h2>
      <p>
        To access certain features of the Platform, you must register for an account. When
        registering, you agree to:
      </p>
      <ul>
        <li>
          Provide accurate, current, and complete information during the registration process.
        </li>
        <li>
          Maintain and promptly update your account information to keep it accurate and complete.
        </li>
        <li>Maintain the security and confidentiality of your login credentials.</li>
        <li>Accept responsibility for all activities that occur under your account.</li>
        <li>
          Register and maintain only one (1) account per person. Creating multiple accounts may
          result in suspension or termination of all associated accounts.
        </li>
      </ul>
      <p>
        You must notify us immediately of any unauthorized use of your account or any other breach
        of security. We shall not be liable for any loss arising from your failure to comply with
        this section.
      </p>

      <h2>4. Listing Rules</h2>
      <p>When creating listings on the Platform, you agree to the following:</p>
      <ul>
        <li>
          All listings must contain accurate and truthful descriptions of the item or service being
          offered.
        </li>
        <li>
          You must have legal ownership or proper authorization to sell or offer the listed item or
          service.
        </li>
        <li>
          Listings must not contain misleading information regarding the condition, quality,
          quantity, or nature of the item.
        </li>
        <li>
          Images used in listings must accurately represent the item being offered and must not
          infringe upon any third-party intellectual property rights.
        </li>
        <li>
          Listings must not include items that are prohibited under these Terms, applicable
          Pakistani law, or any other relevant legislation.
        </li>
        <li>
          You are solely responsible for the content of your listings and any transactions that
          result from them.
        </li>
      </ul>

      <h2>5. Prohibited Items</h2>
      <p>
        The following items and categories are strictly prohibited from being listed on the
        Platform. This list is non-exhaustive, and we reserve the right to remove any listing at our
        sole discretion:
      </p>
      <ul>
        <li>
          Firearms, ammunition, explosives, and weapons of any kind, as regulated under the Pakistan
          Arms Ordinance, 1965.
        </li>
        <li>
          Narcotics, controlled substances, and drug paraphernalia, as defined under the Control of
          Narcotic Substances Act, 1997.
        </li>
        <li>
          Counterfeit goods, including but not limited to fake branded products, forged documents,
          and replica currency.
        </li>
        <li>Stolen property or goods obtained through unlawful means.</li>
        <li>
          Obscene or pornographic material, as defined under Sections 292–294 of the Pakistan Penal
          Code (PPC) and Section 37 of the Prevention of Electronic Crimes Act (PECA), 2016.
        </li>
        <li>
          Items that promote hatred, violence, or discrimination on the basis of religion,
          ethnicity, gender, or sect.
        </li>
        <li>
          Hazardous materials, chemicals, or substances that pose a risk to public health or safety.
        </li>
        <li>Any item or service the sale of which is prohibited under the laws of Pakistan.</li>
      </ul>

      <h2>6. Transactions</h2>
      <p>
        Marketplace.pk serves solely as an online platform that connects buyers and sellers. We are
        not a party to any transaction between users. We do not guarantee, endorse, or assume
        responsibility for any product or service advertised or offered by any seller. We shall not
        be a party to any dispute between buyers and sellers, though we may, at our sole discretion,
        assist in facilitating resolution.
      </p>
      <p>
        Users are advised to exercise due diligence and caution when entering into transactions. We
        recommend meeting in safe, public locations for in-person exchanges and verifying the
        identity of the other party before completing any transaction.
      </p>

      <h2>7. Fees and Payments</h2>
      <p>
        Basic listing on the Platform is free of charge. However, we offer optional paid services,
        including but not limited to:
      </p>
      <ul>
        <li>
          Ad packages that provide enhanced visibility for your listings (e.g., featured listings,
          top placement, highlighted ads).
        </li>
        <li>
          Featured listing promotions that display your ad prominently in search results and
          category pages.
        </li>
        <li>Premium seller subscriptions with additional benefits and increased listing limits.</li>
      </ul>
      <p>
        Payments for paid services may be made through the following methods: JazzCash, EasyPaisa,
        or credit/debit card. All fees are quoted in Pakistani Rupees (PKR) and are inclusive of
        applicable taxes unless stated otherwise. Fees once paid are non-refundable unless otherwise
        specified in the specific service terms or required by applicable law.
      </p>

      <h2>8. Intellectual Property</h2>
      <p>
        All content on the Platform, including but not limited to text, graphics, logos, icons,
        images, audio clips, software, and compilations, is the property of Marketplace.pk or its
        content suppliers and is protected by Pakistani and international intellectual property
        laws, including the Copyright Ordinance, 1962 and the Trade Marks Ordinance, 2001.
      </p>
      <p>
        By posting content on the Platform, you grant Marketplace.pk a non-exclusive, royalty-free,
        worldwide license to use, reproduce, modify, and display such content solely for the purpose
        of operating and promoting the Platform.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, Marketplace.pk, its directors, employees,
        agents, and affiliates shall not be liable for any indirect, incidental, special,
        consequential, or punitive damages, including but not limited to loss of profits, data,
        goodwill, or other intangible losses, arising out of or in connection with:
      </p>
      <ul>
        <li>Your use of or inability to use the Platform.</li>
        <li>Any transaction or interaction between users of the Platform.</li>
        <li>Unauthorized access to or alteration of your data or transmissions.</li>
        <li>Any content posted by third parties on the Platform.</li>
        <li>Any errors, inaccuracies, or omissions in any content on the Platform.</li>
      </ul>

      <h2>10. Dispute Resolution</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the Islamic
        Republic of Pakistan. Any dispute arising out of or in connection with these Terms,
        including any question regarding their existence, validity, or termination, shall be subject
        to the exclusive jurisdiction of the courts located in Lahore, Pakistan.
      </p>
      <p>
        Before initiating any legal proceedings, the parties agree to attempt to resolve any dispute
        through good-faith negotiation for a period of not less than thirty (30) days from the date
        of written notice of the dispute.
      </p>

      <h2>11. Termination</h2>
      <p>
        We reserve the right to suspend or terminate your account and access to the Platform at any
        time, without prior notice or liability, for any reason, including but not limited to a
        breach of these Terms. Upon termination, your right to use the Platform will immediately
        cease. All provisions of these Terms which by their nature should survive termination shall
        survive, including but not limited to ownership provisions, warranty disclaimers, indemnity,
        and limitations of liability.
      </p>

      <h2>12. Changes to Terms</h2>
      <p>
        We reserve the right to modify or replace these Terms at any time at our sole discretion. If
        a revision is material, we will provide at least thirty (30) days' notice prior to any new
        terms taking effect, either by posting a notice on the Platform or by sending an email to
        the address associated with your account. Your continued use of the Platform after such
        changes constitutes your acceptance of the revised Terms.
      </p>

      <h2>13. Contact Information</h2>
      <p>
        If you have any questions or concerns regarding these Terms of Service, please contact us
        at:
      </p>
      <ul>
        <li>Email: <a href="mailto:legal&#64;marketplace.pk">legal&#64;marketplace.pk</a></li>
      </ul>

      <p>
        <em>
          Note: This document is a template and is provided for informational purposes only. It does
          not constitute legal advice. We strongly recommend that you consult with a qualified legal
          professional licensed to practice in Pakistan before relying on these terms.
        </em>
      </p>

      <p class="last-updated">Last updated: January 2025</p>
    </div>
  `,
})
export class TermsComponent {}
