/** SEO configuration for static informational pages. */

import { SEO_SITE_NAME } from './app.constants.js';

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface StaticPageSeoConfig {
  title: string;
  description: string;
  faqs?: FaqEntry[];
}

export const STATIC_PAGE_SEO: Record<string, StaticPageSeoConfig> = {
  about: {
    title: `About Us | ${SEO_SITE_NAME}`,
    description: `Learn about ${SEO_SITE_NAME} — Pakistan's trusted online marketplace for buying and selling new and used products.`,
    faqs: [
      {
        question: `What is ${SEO_SITE_NAME}?`,
        answer: `${SEO_SITE_NAME} is an online marketplace connecting buyers and sellers across Pakistan. You can browse thousands of listings for new and used products in categories like electronics, vehicles, property, and more.`,
      },
      {
        question: `How does ${SEO_SITE_NAME} work?`,
        answer:
          'Sellers create free listings with photos and descriptions. Buyers browse or search for products, then contact sellers directly to negotiate and complete the transaction.',
      },
      {
        question: `Is ${SEO_SITE_NAME} free to use?`,
        answer:
          'Creating an account and browsing listings is completely free. Sellers can post ads at no cost, with optional premium packages available for increased visibility.',
      },
    ],
  },
  terms: {
    title: `Terms of Service | ${SEO_SITE_NAME}`,
    description: `Read the terms of service for ${SEO_SITE_NAME}. Understand your rights and responsibilities when using our online marketplace platform.`,
  },
  privacy: {
    title: `Privacy Policy | ${SEO_SITE_NAME}`,
    description: `Review the privacy policy for ${SEO_SITE_NAME}. Learn how we collect, use, and protect your personal information.`,
  },
  contact: {
    title: `Contact Us | ${SEO_SITE_NAME}`,
    description: `Get in touch with the ${SEO_SITE_NAME} team. Find our contact details, support hours, and ways to reach us for help with your account or listings.`,
    faqs: [
      {
        question: `How can I contact ${SEO_SITE_NAME} support?`,
        answer:
          'You can reach our support team through the contact form on this page, by email, or via our social media channels. Our team typically responds within 24 hours.',
      },
      {
        question: 'What are the support hours?',
        answer:
          'Our customer support team is available Monday through Saturday, 9 AM to 6 PM PKT. You can submit inquiries anytime and we will respond during business hours.',
      },
      {
        question: 'How do I report a suspicious listing?',
        answer:
          'You can report a suspicious listing by clicking the "Report" button on the listing page or by contacting our support team directly with the listing details.',
      },
    ],
  },
  careers: {
    title: `Careers | ${SEO_SITE_NAME}`,
    description: `Explore career opportunities at ${SEO_SITE_NAME}. Join our team and help build the future of online commerce in Pakistan.`,
  },
  press: {
    title: `Press & Media | ${SEO_SITE_NAME}`,
    description: `Find the latest news, press releases, and media resources from ${SEO_SITE_NAME}. Get in touch with our communications team for inquiries.`,
  },
  'trust-safety': {
    title: `Trust & Safety | ${SEO_SITE_NAME}`,
    description: `Learn about the trust and safety measures at ${SEO_SITE_NAME}. Discover how we protect buyers and sellers and keep our marketplace secure.`,
  },
  'selling-tips': {
    title: `Selling Tips | ${SEO_SITE_NAME}`,
    description: `Get expert tips for selling on ${SEO_SITE_NAME}. Learn how to create effective listings, price your items, and close deals faster.`,
    faqs: [
      {
        question: 'How do I create a listing that sells?',
        answer:
          'Use clear, high-quality photos taken in good lighting. Write a detailed and honest description including the condition, brand, and any defects. Set a competitive price by checking similar listings.',
      },
      {
        question: 'How should I price my items?',
        answer: `Research similar listings on ${SEO_SITE_NAME} to understand the market rate. Price competitively and consider leaving a small margin for negotiation. Items priced fairly tend to sell faster.`,
      },
      {
        question: 'How can I make my listing more visible?',
        answer:
          'Choose the correct category, add relevant keywords to your title and description, and upload multiple photos. You can also use our featured listing packages for extra visibility.',
      },
    ],
  },
  cookies: {
    title: `Cookie Policy | ${SEO_SITE_NAME}`,
    description: `Understand how ${SEO_SITE_NAME} uses cookies and similar technologies. Learn about the types of cookies we use and how to manage your preferences.`,
  },
} as const;
