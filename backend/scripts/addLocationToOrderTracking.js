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
    console.log('🔧 Running database migration to add location column to order_tracking...\n');

    // Add location column to order_tracking if not exists
    await pool.query(`
      ALTER TABLE order_tracking 
      ADD COLUMN IF NOT EXISTS location VARCHAR(255)
    `);
    console.log('✅ Added location column to order_tracking table');

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
