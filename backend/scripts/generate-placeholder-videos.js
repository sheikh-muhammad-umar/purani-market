/**
 * Generate minimal valid MP4 placeholder files for testing.
 * These are tiny (~1KB) valid MP4 files with a single black frame.
 * 
 * Usage: node scripts/generate-placeholder-videos.js
 */
const fs = require('fs');
const path = require('path');

// Minimal valid MP4 file (single black frame, ~700 bytes)
// This is a base64-encoded minimal H.264 MP4 with 1 frame
const MINIMAL_MP4_BASE64 = 
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAr1tZGF0AAACrQYF//+p' +
  '3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCBiYWVlNDAwIC0gSC4yNjQvTVBF' +
  'Ry00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly93d3cudmlkZW9sYW4u' +
  'b3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFs' +
  'eXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVk' +
  'X3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBk' +
  'ZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEg' +
  'bG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRl' +
  'cmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJf' +
  'cHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9' +
  'MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3Jl' +
  'ZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAu' +
  'NjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAA' +
  'D2WIhAAh//73aJ8Cm1VJgAAAC0Gavi8AAAA7QZoiCAH/AAADAAAAAAMAAAMA';

const FILENAMES = [
  'product-showcase-1.mp4',
  'phone-unboxing.mp4',
  'car-exterior.mp4',
  'electronics-demo.mp4',
  'fashion-item.mp4',
  'home-appliance.mp4',
];

const uploadsDir = path.resolve(process.cwd(), 'uploads', 'shorts');
const thumbsDir = path.join(uploadsDir, 'thumbs');

// Ensure directories exist
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

// Create a minimal 1x1 JPEG for thumbnails
const MINIMAL_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkz' +
  'ODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2f/2wBDARESEhgVGC8aGC9nQTtBZ2dnZ2dn' +
  'Z2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2f/wAARCAABAAEDASIA' +
  'AhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEA' +
  'AAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=',
  'base64'
);

// Generate video files
const videoBuffer = Buffer.from(MINIMAL_MP4_BASE64, 'base64');

for (const filename of FILENAMES) {
  const videoPath = path.join(uploadsDir, filename);
  const thumbPath = path.join(thumbsDir, filename.replace('.mp4', '.jpg'));

  fs.writeFileSync(videoPath, videoBuffer);
  fs.writeFileSync(thumbPath, MINIMAL_JPEG);
  console.log(`✓ Created ${filename} + thumbnail`);
}

console.log(`\n✅ Generated ${FILENAMES.length} placeholder videos in ${uploadsDir}`);
console.log(`   Thumbnails in ${thumbsDir}`);
