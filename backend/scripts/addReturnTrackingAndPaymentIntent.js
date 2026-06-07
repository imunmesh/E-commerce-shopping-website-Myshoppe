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
    console.log('🔧 Running database migration for Return Tracking & Stripe Payment Intent...\n');

    // 1. Create return_tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS return_tracking (
        id SERIAL PRIMARY KEY,
        return_id INTEGER REFERENCES returns(id) ON DELETE CASCADE,
        status VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created return_tracking table');

    // 2. Add stripe_payment_intent_id to orders table
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255)
    `);
    console.log('✅ Added stripe_payment_intent_id to orders table');

    // 3. Backfill stripe_payment_intent_id from payments table to orders table
    const updateRes = await pool.query(`
      UPDATE orders o
      SET stripe_payment_intent_id = p.stripe_payment_intent_id
      FROM payments p
      WHERE o.id = p.order_id 
        AND o.stripe_payment_intent_id IS NULL 
        AND p.stripe_payment_intent_id IS NOT NULL
    `);
    console.log(`✅ Backfilled stripe_payment_intent_id for ${updateRes.rowCount} existing orders`);

    console.log('\n🎉 Return Tracking & Payment Intent migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
