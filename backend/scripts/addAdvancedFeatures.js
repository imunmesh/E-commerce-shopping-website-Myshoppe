const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    console.log('🔧 Running database migration for advanced features...\n');

    // 1. Alter orders table
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0.00
    `);
    console.log('✅ Altered orders table (added invoice and coupon fields)');

    // 2. Alter reviews table
    await pool.query(`
      ALTER TABLE reviews 
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255)
    `);
    console.log('✅ Altered reviews table (added image fields)');

    // 3. Create recently_viewed table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recently_viewed (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, product_id)
      )
    `);
    console.log('✅ Created recently_viewed table');

    // 4. Create coupons table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        discount_type VARCHAR(20) NOT NULL,
        discount_value DECIMAL(10, 2) NOT NULL,
        minimum_order_amount DECIMAL(10, 2) DEFAULT 0.00,
        usage_limit INTEGER,
        used_count INTEGER DEFAULT 0,
        expiry_date TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log('✅ Created coupons table');

    // 5. Create comparison_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comparison_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, product_id)
      )
    `);
    console.log('✅ Created comparison_history table');

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
