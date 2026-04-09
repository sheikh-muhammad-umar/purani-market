import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  styleUrl: '../pages.scss',
  template: `
    <div class="static-page">
      <h1>About Us</h1>
      <p class="page-subtitle">Connecting buyers and sellers across Pakistan</p>

      <h2>Our Mission</h2>
      <p>
        Marketplace is Pakistan's leading online classifieds platform, dedicated to connecting
        buyers and sellers across the country. We make it simple, safe, and convenient for anyone
        to buy and sell almost anything — from electronics and vehicles to property and services.
      </p>
      <p>
        Our mission is to empower millions of Pakistanis by providing a trusted digital marketplace
        where commerce is accessible to everyone, regardless of location or background.
      </p>

      <h2>Our Story</h2>
      <p>
        Founded in Pakistan, Marketplace was built with a deep understanding of local needs and
        culture. From bustling Karachi to the northern valleys of Gilgit-Baltistan, we proudly
        serve buyers and sellers in all provinces and territories — Punjab, Sindh, Khyber
        Pakhtunkhwa, Balochistan, Islamabad Capital Territory, Azad Kashmir, and Gilgit-Baltistan.
      </p>

      <h2>Our Values</h2>
      <ul>
        <li><strong>Trust:</strong> We build confidence through verified profiles, secure transactions, and transparent policies.</li>
        <li><strong>Safety:</strong> Protecting our users is our top priority — from fraud prevention to safe meetup guidelines.</li>
        <li><strong>Community:</strong> We believe in the power of local communities and strive to strengthen connections between people.</li>
      </ul>

      <h2>Marketplace at a Glance</h2>
      <div class="card-grid">
        <div class="info-card">
          <h3>1M+</h3>
          <p>Registered users across Pakistan</p>
        </div>
        <div class="info-card">
          <h3>500K+</h3>
          <p>Active listings at any given time</p>
        </div>
        <div class="info-card">
          <h3>100+</h3>
          <p>Cities and towns served nationwide</p>
        </div>
        <div class="info-card">
          <h3>24/7</h3>
          <p>Customer support availability</p>
        </div>
      </div>

      <h2>Our Team</h2>
      <p>
        Our headquarters are located in Lahore, the heart of Pakistan's tech ecosystem. Our
        diverse team of engineers, designers, marketers, and support specialists work together
        to deliver the best possible experience for our users. We're passionate about technology
        and committed to making online commerce work for everyone in Pakistan.
      </p>
      <p>
        Want to join us? Check out our <a routerLink="/pages/careers">open positions</a>.
      </p>
    </div>
  `,
})
export class AboutComponent {}
