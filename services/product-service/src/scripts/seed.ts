import mongoose from 'mongoose';
import Product from '../models/Product.model';
import Category from '../models/Category.model';
import dotenv from 'dotenv';

dotenv.config();

const categories = [
  { name: 'Electronics', slug: 'electronics', description: 'Electronic devices and gadgets', order: 1 },
  { name: 'Fashion', slug: 'fashion', description: 'Clothing and accessories', order: 2 },
  { name: 'Home & Garden', slug: 'home-garden', description: 'Home decor and garden items', order: 3 },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors', description: 'Sports equipment and outdoor gear', order: 4 },
  { name: 'Jewelry & Watches', slug: 'jewelry-watches', description: 'Fine jewelry and luxury watches', order: 5 },
  { name: 'Collectibles & Art', slug: 'collectibles-art', description: 'Rare collectibles and artwork', order: 6 },
  { name: 'Real Estate', slug: 'real-estate', description: 'Properties and land', order: 7 },
  { name: 'Automotive', slug: 'automotive', description: 'Cars, motorcycles, and parts', order: 8 },
];

const sampleProducts = [
  {
    title: 'Vintage Rolex Submariner Watch',
    description: 'Authentic vintage Rolex Submariner from 1960s. Fully serviced and authenticated. Comes with original box and papers.',
    category: 'jewelry-watches',
    images: ['https://picsum.photos/600/600?random=1'],
    priceInCoins: 25.5,
    priceInUSD: 50000,
    condition: 'LIKE_NEW',
    quantity: 1,
    location: 'New York, USA',
    tags: ['luxury', 'vintage', 'rolex', 'watch'],
    sellerId: 'seed-seller-1',
    sellerName: 'Luxury Timepieces',
  },
  {
    title: 'Limited Edition NFT Art Print',
    description: 'Physical print of popular NFT artwork. Signed by the artist. Only 100 editions available.',
    category: 'collectibles-art',
    images: ['https://picsum.photos/600/600?random=2'],
    priceInCoins: 2.5,
    priceInUSD: 5000,
    condition: 'NEW',
    quantity: 5,
    location: 'Los Angeles, USA',
    tags: ['nft', 'art', 'limited-edition', 'crypto-art'],
    sellerId: 'seed-seller-2',
    sellerName: 'CryptoArt Gallery',
  },
  {
    title: 'Tesla Model S P100D',
    description: 'Tesla Model S P100D with Ludicrous Mode. Low mileage, full self-driving capability.',
    category: 'automotive',
    images: ['https://picsum.photos/600/600?random=3'],
    priceInCoins: 40.0,
    priceInUSD: 80000,
    condition: 'GOOD',
    quantity: 1,
    location: 'San Francisco, USA',
    tags: ['tesla', 'electric', 'luxury-car', 'autopilot'],
    sellerId: 'seed-seller-3',
    sellerName: 'Premium Auto Sales',
  },
  {
    title: 'MacBook Pro 16" M3 Max',
    description: 'Latest MacBook Pro with M3 Max chip, 64GB RAM, 2TB SSD. Perfect for professionals.',
    category: 'electronics',
    images: ['https://picsum.photos/600/600?random=4'],
    priceInCoins: 1.5,
    priceInUSD: 3000,
    condition: 'NEW',
    quantity: 10,
    location: 'Seattle, USA',
    tags: ['apple', 'laptop', 'macbook', 'professional'],
    sellerId: 'seed-seller-4',
    sellerName: 'Tech Store',
  },
  {
    title: 'Beachfront Villa in Bali',
    description: 'Luxurious beachfront villa with 5 bedrooms, infinity pool, and ocean views.',
    category: 'real-estate',
    images: ['https://picsum.photos/600/600?random=5'],
    priceInCoins: 250.0,
    priceInUSD: 500000,
    condition: 'NEW',
    quantity: 1,
    location: 'Bali, Indonesia',
    tags: ['villa', 'beachfront', 'luxury', 'investment'],
    sellerId: 'seed-seller-5',
    sellerName: 'Tropical Real Estate',
  },
  // Add more products to reach 22
  ...Array.from({ length: 17 }, (_, i) => ({
    title: `Premium Product ${i + 6}`,
    description: `High-quality product description for item ${i + 6}. This is a tokenized real-world asset with full authenticity guarantee.`,
    category: categories[i % categories.length].slug,
    images: [`https://picsum.photos/600/600?random=${i + 6}`],
    priceInCoins: (Math.random() * 10 + 0.5).toFixed(2),
    priceInUSD: (Math.random() * 10000 + 500).toFixed(2),
    condition: ['NEW', 'LIKE_NEW', 'GOOD'][Math.floor(Math.random() * 3)] as any,
    quantity: Math.floor(Math.random() * 10) + 1,
    location: ['New York', 'Los Angeles', 'London', 'Tokyo', 'Paris'][Math.floor(Math.random() * 5)],
    tags: ['premium', 'tokenized', 'verified', 'trending'],
    sellerId: `seed-seller-${(i % 5) + 1}`,
    sellerName: `Seller ${(i % 5) + 1}`,
  })),
];

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_PRODUCT || 'product_db';
    await mongoose.connect(`${mongoUri}/${dbName}`);

    console.log('Connected to MongoDB');

    // Clear existing data
    await Product.deleteMany({});
    await Category.deleteMany({});
    console.log('Cleared existing data');

    // Seed categories
    await Category.insertMany(categories);
    console.log(`Seeded ${categories.length} categories`);

    // Seed products
    await Product.insertMany(sampleProducts);
    console.log(`Seeded ${sampleProducts.length} products`);

    console.log('✅ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();

