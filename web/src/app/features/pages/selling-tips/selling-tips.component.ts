import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-selling-tips',
  standalone: true,
  imports: [RouterLink],
  styleUrl: '../pages.scss',
  template: `
    <div class="static-page">
      <h1>Selling Tips</h1>
      <p class="page-subtitle">
        Sell faster and get the best price with these practical tips from experienced sellers across
        Pakistan.
      </p>

      <h2>📸 Take Great Photos</h2>
      <div class="card-grid">
        <div class="info-card">
          <h3>Use Natural Light</h3>
          <p>
            Photograph your items near a window or outdoors during the day. Natural light shows true
            colours and makes your listing look professional.
          </p>
        </div>
        <div class="info-card">
          <h3>Multiple Angles</h3>
          <p>
            Include at least 4–5 photos: front, back, sides, and close-ups of any labels, serial
            numbers, or defects. Buyers trust listings with more images.
          </p>
        </div>
        <div class="info-card">
          <h3>Clean Background</h3>
          <p>
            Place items against a plain, uncluttered background. A white sheet or clean table works
            perfectly. Avoid messy rooms in the background.
          </p>
        </div>
      </div>

      <h2>✍️ Write Detailed Descriptions</h2>
      <ul>
        <li>
          <strong>Be specific</strong> — include brand, model, size, colour, age, and any relevant
          specifications.
        </li>
        <li>
          <strong>Be honest about condition</strong> — clearly state if the item is new, used, or
          refurbished. Mention any scratches, dents, or defects upfront.
        </li>
        <li>
          <strong>Include accessories</strong> — list everything included (charger, box, warranty
          card, etc.).
        </li>
        <li>
          <strong>Mention the reason for selling</strong> — buyers appreciate knowing why you're
          parting with the item. It builds trust.
        </li>
        <li>
          <strong>Use keywords</strong> — include terms buyers might search for, such as the model
          number or common name.
        </li>
      </ul>

      <h2>💰 Price Competitively</h2>
      <ul>
        <li>
          <strong>Research similar listings</strong> — browse our marketplace to see what similar
          items are selling for in your city.
        </li>
        <li>
          <strong>Factor in condition</strong> — a used item in good condition typically sells for
          50–70% of the retail price.
        </li>
        <li>
          <strong>Leave room for negotiation</strong> — Pakistani buyers love to bargain. Price
          slightly above your minimum acceptable amount.
        </li>
        <li>
          <strong>Be transparent about price</strong> — avoid "call for price" listings. Buyers are
          more likely to engage when the price is clearly stated.
        </li>
        <li>
          <strong>Update your price</strong> — if your item hasn't sold in a week, consider lowering
          the price by 10–15%.
        </li>
      </ul>

      <h2>⚡ Respond Quickly</h2>
      <p>
        Fast responses dramatically increase your chances of making a sale. Buyers often message
        multiple sellers and go with whoever replies first.
      </p>
      <ul>
        <li>Enable push notifications so you never miss a message.</li>
        <li>Aim to respond within 30 minutes during business hours.</li>
        <li>Be polite and answer questions thoroughly — even if they seem obvious.</li>
        <li>If you're unavailable, set a status message so buyers know when to expect a reply.</li>
      </ul>

      <h2>🤝 Be Honest About Defects</h2>
      <p>
        Transparency builds trust and avoids wasted trips for both parties. If your item has a
        cracked screen, a missing button, or a battery issue — say so in the description and show it
        in the photos. Honest sellers get better reviews and repeat buyers.
      </p>

      <h2>📍 Meet in Safe Locations</h2>
      <ul>
        <li>
          Choose busy public places like shopping malls, bank branches, or well-known restaurants.
        </li>
        <li>Avoid inviting strangers to your home or going to theirs.</li>
        <li>
          For high-value items (phones, laptops, vehicles), consider meeting near a police station.
        </li>
        <li>Bring a friend or family member along, especially for evening meetups.</li>
        <li>Read more on our <a routerLink="/trust-safety">Trust &amp; Safety</a> page.</li>
      </ul>

      <h2>💳 Accept Secure Payment Methods</h2>
      <div class="card-grid">
        <div class="info-card">
          <h3>JazzCash</h3>
          <p>
            Widely used across Pakistan. Confirm receipt of payment before handing over the item.
            Verify the transaction notification on your own phone.
          </p>
        </div>
        <div class="info-card">
          <h3>EasyPaisa</h3>
          <p>
            Another trusted mobile wallet option. Always verify the payment has been credited to
            your account — don't rely on screenshots from the buyer.
          </p>
        </div>
        <div class="info-card">
          <h3>Bank Transfer</h3>
          <p>
            For high-value items, a direct bank transfer is the safest option. Wait for the amount
            to reflect in your account before completing the deal.
          </p>
        </div>
      </div>
      <p>
        Avoid accepting cheques or promises of future payment. Cash on delivery is fine for
        in-person meetups.
      </p>

      <h2>🚀 Boost Your Listings</h2>
      <ul>
        <li>
          <strong>Featured Ads</strong> — get your listing highlighted at the top of search results
          for maximum visibility.
        </li>
        <li>
          <strong>Refresh your ad</strong> — bump your listing to appear as newly posted without
          creating a duplicate.
        </li>
        <li>
          <strong>Packages</strong> — check our <a routerLink="/packages">ad packages</a> for bulk
          posting discounts and premium placement options.
        </li>
        <li>
          <strong>Share on social media</strong> — post your listing link on Facebook Marketplace
          groups, WhatsApp groups, and Instagram stories for extra reach.
        </li>
      </ul>

      <p class="last-updated">Last updated: June 2025</p>
    </div>
  `,
})
export class SellingTipsComponent {}
