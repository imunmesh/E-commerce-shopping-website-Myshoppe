const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addDatabaseConstraints() {
  try {
    console.log('🔧 Adding database constraints...\n');

    // Add UNIQUE constraint on SKU
    console.log('📝 Adding UNIQUE constraint on SKU...');
    try {
      await pool.query(`
        ALTER TABLE products 
        ADD CONSTRAINT products_sku_unique UNIQUE (sku)
      `);
      console.log('   ✅ SKU UNIQUE constraint added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  SKU UNIQUE constraint already exists');
      } else {
        console.log(`   ❌ Error adding SKU constraint: ${error.message}`);
      }
    }

    // Add external_product_id column if it doesn't exist
    console.log('\n📝 Adding external_product_id column...');
    try {
      await pool.query(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS external_product_id VARCHAR(100)
      `);
      console.log('   ✅ external_product_id column added');
    } catch (error) {
      console.log(`   ⚠️  Error adding column: ${error.message}`);
    }

    // Add UNIQUE constraint on external_product_id
    console.log('\n📝 Adding UNIQUE constraint on external_product_id...');
    try {
      await pool.query(`
        ALTER TABLE products 
        ADD CONSTRAINT products_external_product_id_unique UNIQUE (external_product_id)
      `);
      console.log('   ✅ external_product_id UNIQUE constraint added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  external_product_id UNIQUE constraint already exists');
      } else {
        console.log(`   ❌ Error adding external_product_id constraint: ${error.message}`);
      }
    }

    // Verify foreign key constraints
    console.log('\n🔍 Verifying foreign key constraints...');
    
    const fkCheck = await pool.query(`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('product_images', 'product_variants')
    `);

    console.log('   Foreign key constraints:');
    fkCheck.rows.forEach(row => {
      console.log(`     ${row.table_name}.${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
    });

    console.log('\n✅ Database constraints setup complete');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addDatabaseConstraints();
