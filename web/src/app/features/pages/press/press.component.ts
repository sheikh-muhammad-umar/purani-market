import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-press',
  standalone: true,
  imports: [RouterLink],
  styleUrl: '../pages.scss',
  template: `
    <div class="static-page">
      <h1>Press &amp; Media</h1>
      <p class="page-subtitle">News, resources, and media inquiries</p>

      <h2>Company Overview</h2>
      <p>
        Marketplace is Pakistan's leading online classifieds platform, connecting over one million
        users across 100+ cities. Headquartered in Lahore, we enable individuals and businesses
        to buy and sell goods and services in categories ranging from electronics and vehicles to
        property and fashion. Our mission is to make commerce accessible, safe, and convenient
        for every Pakistani.
      </p>

      <h2>Press Releases</h2>
      <div class="card-grid">
        <div class="info-card">
          <h3>Marketplace Reaches 1 Million Users</h3>
          <p>January 2025</p>
          <p>A major milestone as our community continues to grow across all provinces of Pakistan.</p>
        </div>
        <div class="info-card">
          <h3>Launch of Verified Seller Program</h3>
          <p>November 2024</p>
          <p>New trust and safety initiative to give buyers more confidence when shopping online.</p>
        </div>
        <div class="info-card">
          <h3>Expansion to 100+ Cities</h3>
          <p>August 2024</p>
          <p>Marketplace now serves buyers and sellers in over 100 cities and towns nationwide.</p>
        </div>
        <div class="info-card">
          <h3>Series A Funding Announcement</h3>
          <p>March 2024</p>
          <p>Marketplace secures funding to accelerate growth and invest in product innovation.</p>
        </div>
      </div>

      <h2>Brand Assets</h2>
      <p>
        For official logos, brand guidelines, and media assets, please contact our press team.
        All brand materials are available for editorial use only. Modification of logos or
        brand elements is not permitted without prior written approval.
      </p>

      <h2>Press Contact</h2>
      <p>
        For media inquiries, interview requests, or press kit access, please reach out to our
        communications team at
        <a href="mailto:press&#64;marketplace.pk">press&#64;marketplace.pk</a>.
        We aim to respond to all press inquiries within 24 hours.
      </p>
      <p>
        For general company information, visit our <a routerLink="/pages/about">About Us</a> page.
      </p>
    </div>
  `,
})
export class PressComponent {}
