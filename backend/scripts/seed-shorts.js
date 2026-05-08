/**
 * Seed short videos for testing.
 * Creates sample short video records linked to existing users, categories, and locations.
 *
 * Usage: node scripts/seed-shorts.js
 */
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

// Sample video URLs (short, royalty-free clips from Pexels/Pixabay CDN)
const SAMPLE_VIDEOS = [
  {
    url: 'https://cdn.pixabay.com/video/2024/02/23/201395-916052507_tiny.mp4',
    filename: 'product-showcase-1.mp4',
  },
  {
    url: 'https://cdn.pixabay.com/video/2020/07/30/45875-445039498_tiny.mp4',
    filename: 'phone-unboxing.mp4',
  },
  {
    url: 'https://cdn.pixabay.com/video/2021/04/06/70028-534224498_tiny.mp4',
    filename: 'car-exterior.mp4',
  },
  {
    url: 'https://cdn.pixabay.com/video/2019/11/08/28698-372259498_tiny.mp4',
    filename: 'electronics-demo.mp4',
  },
  {
    url: 'https://cdn.pixabay.com/video/2020/05/25/40052-424930080_tiny.mp4',
    filename: 'fashion-item.mp4',
  },
  {
    url: 'https://cdn.pixabay.com/video/2021/02/22/65804-516311580_tiny.mp4',
    filename: 'home-appliance.mp4',
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;

    client
      .get(url, (response) => {
        // Follow redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(dest);
        });
      })
      .on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
  });
}

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    console.log('Connected to MongoDB');

    // Get existing users
    const users = await db
      .collection('users')
      .find({ status: 'active' })
      .limit(6)
      .toArray();

    if (users.length === 0) {
      console.error('No active users found. Run other seed scripts first.');
      return;
    }
    console.log(`Found ${users.length} users`);

    // Get categories
    const categories = await db.collection('categories').find({ isActive: true }).toArray();
    const electronics = categories.find((c) => c.name === 'Electronics');
    const mobilePhones = categories.find((c) => c.name === 'Mobile Phones');
    const vehicles = categories.find((c) => c.name === 'Vehicles');
    const cars = categories.find((c) => c.name === 'Cars');
    const fashion = categories.find((c) => c.name === 'Fashion' || c.name === 'Clothing');
    const home = categories.find((c) => c.name === 'Home' || c.name === 'Home & Garden');

    // Get locations
    const provinces = await db.collection('provinces').find({}).toArray();
    const punjab = provinces.find((p) => p.name === 'Punjab');
    const sindh = provinces.find((p) => p.name === 'Sindh');
    const kpk = provinces.find((p) => p.name === 'KPK' || p.name === 'Khyber Pakhtunkhwa');
    const islamabad = provinces.find((p) => p.name === 'Islamabad' || p.name === 'ICT');

    const cities = await db.collection('cities').find({}).toArray();
    const lahore = cities.find((c) => c.name === 'Lahore');
    const karachi = cities.find((c) => c.name === 'Karachi');
    const islamabadCity = cities.find((c) => c.name === 'Islamabad');
    const rawalpindi = cities.find((c) => c.name === 'Rawalpindi');
    const faisalabad = cities.find((c) => c.name === 'Faisalabad');
    const peshawar = cities.find((c) => c.name === 'Peshawar');

    // Download sample videos
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'shorts');
    console.log('Downloading sample videos...');

    const downloadedFiles = [];
    for (const video of SAMPLE_VIDEOS) {
      const dest = path.join(uploadsDir, video.filename);
      if (fs.existsSync(dest)) {
        console.log(`  ✓ ${video.filename} (already exists)`);
        downloadedFiles.push(dest);
      } else {
        try {
          await downloadFile(video.url, dest);
          console.log(`  ✓ ${video.filename} downloaded`);
          downloadedFiles.push(dest);
        } catch (err) {
          console.warn(`  ✗ ${video.filename} failed: ${err.message}`);
          downloadedFiles.push(null);
        }
      }
    }

    // Create thumbnail placeholders
    const thumbsDir = path.join(uploadsDir, 'thumbs');
    if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

    const port = process.env.PORT || 3000;
    const baseUrl = `http://localhost:${port}/uploads/shorts`;

    // Short video records
    const shortsData = [
      {
        title: 'iPhone 15 Pro Max Unboxing',
        description: 'Unboxing the brand new iPhone 15 Pro Max in Natural Titanium. Check out the camera quality and build!',
        categoryId: mobilePhones?._id || electronics?._id,
        categoryName: 'Mobile Phones',
        location: {
          provinceId: punjab?._id,
          cityId: lahore?._id,
          province: 'Punjab',
          city: 'Lahore',
        },
        videoFile: SAMPLE_VIDEOS[1].filename,
      },
      {
        title: 'Toyota Corolla 2024 Walk-around',
        description: 'Full exterior and interior tour of the Toyota Corolla Grande 2024. Only 5000km driven, like new condition.',
        categoryId: cars?._id || vehicles?._id,
        categoryName: 'Cars',
        location: {
          provinceId: sindh?._id,
          cityId: karachi?._id,
          province: 'Sindh',
          city: 'Karachi',
        },
        videoFile: SAMPLE_VIDEOS[2].filename,
      },
      {
        title: 'Samsung Galaxy S24 Ultra Review',
        description: 'Quick review of Samsung Galaxy S24 Ultra. AI features, camera test, and S-Pen demo in 60 seconds.',
        categoryId: mobilePhones?._id || electronics?._id,
        categoryName: 'Mobile Phones',
        location: {
          provinceId: islamabad?._id || punjab?._id,
          cityId: islamabadCity?._id || rawalpindi?._id,
          province: 'Islamabad',
          city: 'Islamabad',
        },
        videoFile: SAMPLE_VIDEOS[0].filename,
      },
      {
        title: 'Gaming PC Build Showcase',
        description: 'Custom gaming PC with RTX 4070, Ryzen 7 7800X3D, 32GB RAM. RGB setup and cable management tour.',
        categoryId: electronics?._id,
        categoryName: 'Electronics',
        location: {
          provinceId: punjab?._id,
          cityId: rawalpindi?._id,
          province: 'Punjab',
          city: 'Rawalpindi',
        },
        videoFile: SAMPLE_VIDEOS[3].filename,
      },
      {
        title: 'Designer Kurta Collection 2024',
        description: 'New arrival designer kurtas for Eid. Premium fabric, hand embroidery. Available in all sizes.',
        categoryId: fashion?._id || electronics?._id,
        categoryName: fashion?.name || 'Fashion',
        location: {
          provinceId: punjab?._id,
          cityId: faisalabad?._id || lahore?._id,
          province: 'Punjab',
          city: faisalabad?.name || 'Faisalabad',
        },
        videoFile: SAMPLE_VIDEOS[4].filename,
      },
      {
        title: 'Automatic Washing Machine Demo',
        description: 'Haier 8kg fully automatic washing machine in action. Multiple wash modes, energy efficient, 2 year warranty.',
        categoryId: home?._id || electronics?._id,
        categoryName: home?.name || 'Home & Garden',
        location: {
          provinceId: kpk?._id || punjab?._id,
          cityId: peshawar?._id || lahore?._id,
          province: kpk?.name || 'KPK',
          city: peshawar?.name || 'Peshawar',
        },
        videoFile: SAMPLE_VIDEOS[5].filename,
      },
    ];

    // Clear existing seeded shorts
    const existingCount = await db.collection('short_videos').countDocuments();
    if (existingCount > 0) {
      console.log(`Clearing ${existingCount} existing shorts...`);
      await db.collection('short_videos').deleteMany({});
    }

    // Insert shorts
    const now = new Date();
    const shorts = shortsData.map((data, i) => {
      const user = users[i % users.length];
      const videoUrl = `${baseUrl}/${data.videoFile}`;
      const thumbUrl = `${baseUrl}/thumbs/${data.videoFile.replace('.mp4', '.jpg')}`;
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      return {
        sellerId: user._id,
        title: data.title,
        description: data.description,
        categoryId: data.categoryId ? new ObjectId(data.categoryId) : undefined,
        categoryName: data.categoryName,
        location: data.location
          ? {
              provinceId: data.location.provinceId ? new ObjectId(data.location.provinceId) : undefined,
              cityId: data.location.cityId ? new ObjectId(data.location.cityId) : undefined,
              province: data.location.province,
              city: data.location.city,
            }
          : undefined,
        video: {
          url: videoUrl,
          thumbnailUrl: thumbUrl,
          compressedUrl: videoUrl,
          duration: 15 + Math.floor(Math.random() * 45), // 15-60 seconds
          originalSize: 2 * 1024 * 1024 + Math.floor(Math.random() * 8 * 1024 * 1024),
          compressedSize: 1 * 1024 * 1024 + Math.floor(Math.random() * 4 * 1024 * 1024),
          width: 720,
          height: 1280,
        },
        status: 'active',
        rejectionCount: 0,
        viewCount: Math.floor(Math.random() * 500),
        favoriteCount: Math.floor(Math.random() * 50),
        expiresAt,
        isPaid: i < 3 ? false : true, // first 3 are free, rest are paid
        createdAt: new Date(now.getTime() - i * 3600000), // stagger creation times
        updatedAt: now,
      };
    });

    const result = await db.collection('short_videos').insertMany(shorts);
    console.log(`\n✅ Inserted ${result.insertedCount} short videos`);

    // Print summary
    console.log('\nSeeded shorts:');
    shorts.forEach((s, i) => {
      const user = users[i % users.length];
      const name = `${user.profile?.firstName || 'User'} ${user.profile?.lastName || ''}`.trim();
      console.log(`  ${i + 1}. "${s.title}" by ${name} in ${s.location?.city || 'Unknown'} [${s.categoryName}]`);
    });

  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await client.close();
  }
}

seed();
