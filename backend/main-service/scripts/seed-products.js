const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1@localhost:5433/marketplace_db',
});

const categories = ['electronics', 'fashion', 'home', 'sports', 'books', 'toys'];
const tokens = ['USDT', 'USDC', 'DAI', 'MATIC', 'ETH'];

const productNames = {
  electronics: ['Laptop', 'Smartphone', 'Tablet', 'Smartwatch', 'Headphones', 'Camera', 'Speaker', 'Monitor', 'Keyboard', 'Mouse'],
  fashion: ['T-Shirt', 'Jeans', 'Dress', 'Jacket', 'Sneakers', 'Handbag', 'Sunglasses', 'Watch', 'Belt', 'Hat'],
  home: ['Sofa', 'Table', 'Chair', 'Lamp', 'Rug', 'Mirror', 'Vase', 'Clock', 'Curtain', 'Pillow'],
  sports: ['Basketball', 'Football', 'Tennis Racket', 'Yoga Mat', 'Dumbbells', 'Bike', 'Skateboard', 'Helmet', 'Jersey', 'Shoes'],
  books: ['Novel', 'Cookbook', 'Biography', 'Textbook', 'Comic', 'Magazine', 'Dictionary', 'Atlas', 'Guide', 'Journal'],
  toys: ['Action Figure', 'Doll', 'Puzzle', 'Board Game', 'Robot', 'Car', 'Plane', 'Building Blocks', 'Teddy Bear', 'Yo-Yo'],
};

const brands = ['Premium', 'Deluxe', 'Pro', 'Elite', 'Ultimate', 'Classic', 'Modern', 'Vintage', 'Limited', 'Special'];
const adjectives = ['Amazing', 'Awesome', 'Best', 'Quality', 'Top', 'Great', 'Super', 'Mega', 'Ultra', 'Perfect'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice() {
  return (Math.random() * 990 + 10).toFixed(2);
}

function randomStock() {
  return Math.floor(Math.random() * 100) + 1;
}

async function seedProducts() {
  try {
    console.log('🌱 Starting product seed...');

    // Get or create seller
    let sellerId;
    const userResult = await pool.query('SELECT user_id FROM users WHERE role = $1 LIMIT 1', ['seller']);
    
    if (userResult.rows.length === 0) {
      const newUser = await pool.query(
        `INSERT INTO users (email, password_hash, username, role, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id`,
        ['seller@marketplace.com', '$2b$10$dummy', 'Demo Seller', 'seller', 'active']
      );
      sellerId = newUser.rows[0].user_id;
      console.log('✓ Created demo seller user');
    } else {
      sellerId = userResult.rows[0].user_id;
      console.log('✓ Using existing seller user');
    }

    // Generate 100 products
    let created = 0;
    for (let i = 0; i < 100; i++) {
      const category = randomElement(categories);
      const baseName = randomElement(productNames[category]);
      const brand = randomElement(brands);
      const adj = randomElement(adjectives);
      
      const name = `${adj} ${brand} ${baseName}`;
      const description = `High quality ${baseName.toLowerCase()} for sale. ${adj} condition, ${brand.toLowerCase()} brand. Perfect for everyday use.`;
      const price = randomPrice();
      const stock = randomStock();
      
      // Random accepted tokens
      const numTokens = Math.floor(Math.random() * 3) + 2;
      const acceptedCrypto = [];
      for (let j = 0; j < numTokens; j++) {
        const token = randomElement(tokens);
        if (!acceptedCrypto.includes(token)) {
          acceptedCrypto.push(token);
        }
      }
      
      const acceptPaypal = Math.random() > 0.5;
      const acceptedFiat = acceptPaypal ? ['paypal'] : [];
      
      const metadata = {
        category,
        images: [
          `https://via.placeholder.com/400/4F46E5/FFFFFF?text=${encodeURIComponent(baseName)}`,
        ],
        accepted_tokens: {
          crypto: acceptedCrypto,
          fiat: acceptedFiat,
        },
        attributes: {
          brand: brand,
          condition: 'New',
        },
      };

      const result = await pool.query(
        `INSERT INTO products (seller_id, name, description, base_price_usd, metadata, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING product_id`,
        [sellerId, name, description, price, JSON.stringify(metadata), 'active']
      );

      const productId = result.rows[0].product_id;

      // Create inventory
      await pool.query(
        `INSERT INTO inventory (product_id, total_stock, available)
         VALUES ($1, $2, $2)`,
        [productId, stock]
      );

      created++;
      if (created % 10 === 0) {
        console.log(`✓ Created ${created}/100 products...`);
      }
    }

    console.log('\n🎉 Successfully seeded 100 products!');
    console.log(`📦 Seller ID: ${sellerId}`);
    console.log('\n📊 Category distribution:');
    
    const stats = await pool.query(`
      SELECT metadata->>'category' as category, COUNT(*) as count
      FROM products
      WHERE seller_id = $1
      GROUP BY metadata->>'category'
      ORDER BY count DESC
    `, [sellerId]);
    
    stats.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} products`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Seed error:', error);
    await pool.end();
    process.exit(1);
  }
}

seedProducts();
