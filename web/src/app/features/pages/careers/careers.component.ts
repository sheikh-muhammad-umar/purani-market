import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-careers',
  standalone: true,
  imports: [RouterLink],
  styleUrl: '../pages.scss',
  template: `
    <div class="static-page">
      <h1>Careers</h1>
      <p class="page-subtitle">Join our team and help shape the future of commerce in Pakistan</p>

      <h2>Life at Marketplace</h2>
      <p>
        We're a fast-paced startup based in Lahore, building Pakistan's most trusted online
        marketplace. Our culture is rooted in collaboration, innovation, and a shared passion
        for solving real problems for millions of Pakistanis. Every day brings new challenges
        and opportunities to make an impact.
      </p>

      <h2>Benefits &amp; Perks</h2>
      <ul>
        <li><strong>Competitive Salary:</strong> Market-leading compensation packages benchmarked to Pakistan's tech industry.</li>
        <li><strong>Health Insurance:</strong> Comprehensive medical coverage for you and your family, in compliance with Pakistan labor laws.</li>
        <li><strong>Flexible Hours:</strong> We trust you to manage your time — focus on results, not clock-watching.</li>
        <li><strong>Remote Options:</strong> Work from home or our Lahore office — your choice.</li>
        <li><strong>Learning Budget:</strong> Annual allowance for courses, conferences, and certifications.</li>
        <li><strong>Paid Time Off:</strong> Generous leave policy including public holidays and annual leave.</li>
      </ul>

      <h2>Open Positions</h2>
      <div class="card-grid">
        <div class="info-card">
          <h3>Full Stack Developer</h3>
          <p>Engineering · Lahore / Remote</p>
          <p>Build and scale our platform using Angular, Node.js, and MongoDB.</p>
        </div>
        <div class="info-card">
          <h3>Product Designer</h3>
          <p>Design · Lahore / Remote</p>
          <p>Craft intuitive experiences for millions of users across Pakistan.</p>
        </div>
        <div class="info-card">
          <h3>Marketing Manager</h3>
          <p>Marketing · Lahore</p>
          <p>Drive growth through creative campaigns and data-driven strategies.</p>
        </div>
        <div class="info-card">
          <h3>Customer Support Lead</h3>
          <p>Operations · Lahore</p>
          <p>Lead our support team and ensure world-class service for every user.</p>
        </div>
      </div>

      <h2>How to Apply</h2>
      <p>
        Send your CV and a brief cover letter to
        <a href="mailto:careers&#64;marketplace.pk">careers&#64;marketplace.pk</a>.
        Please include the position title in the subject line. We review every application
        and aim to respond within one week.
      </p>
      <p>
        Learn more about our company on the <a routerLink="/pages/about">About Us</a> page.
      </p>
    </div>
  `,
})
export class CareersComponent {}
