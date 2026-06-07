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
    console.log('🔧 Running database migration for advanced agent and settings features...\n');

    // 1. Create system_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created system_settings table');

    // Seed defaults
    await pool.query(`
      INSERT INTO system_settings (key, value) 
      VALUES ('tracking_mode', 'development') 
      ON CONFLICT (key) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO system_settings (key, value) 
      VALUES ('tracking_speed', 'demo') 
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('✅ Seeded default settings');

    // 2. Alter orders table (add courier_name and tracking_number)
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100)
    `);
    console.log('✅ Added courier_name and tracking_number to orders table');

    // 3. Alter returns table (add order_item_id)
    await pool.query(`
      ALTER TABLE returns 
      ADD COLUMN IF NOT EXISTS order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE
    `);
    console.log('✅ Added order_item_id column to returns table');

    // 4. Create user_preferences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        preferences JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created user_preferences table');

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
