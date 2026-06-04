const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateProductsTable() {
  try {
    console.log('🔄 Starting products table migration...');

    // Check if columns already exist
    const checkColumn = async (columnName) => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'products'
        AND column_name = $1
      `, [columnName]);
      return result.rows.length > 0;
    };

    const checkColumnInTable = async (tableName, columnName) => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        AND column_name = $2
      `, [tableName, columnName]);
      return result.rows.length > 0;
    };

    const columnsToAdd = [
      { name: 'review_count', type: 'INTEGER DEFAULT 0' },
      { name: 'sku', type: 'VARCHAR(100) UNIQUE' },
      { name: 'thumbnail', type: 'TEXT' },
      { name: 'is_bestseller', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_featured', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_new_arrival', type: 'BOOLEAN DEFAULT FALSE' }
    ];

    for (const column of columnsToAdd) {
      const exists = await checkColumn(column.name);
      if (!exists) {
        console.log(`➕ Adding column: ${column.name}`);
        await pool.query(`ALTER TABLE products ADD COLUMN ${column.name} ${column.type}`);
        console.log(`✅ Column ${column.name} added successfully`);
      } else {
        console.log(`⏭️  Column ${column.name} already exists, skipping`);
      }
    }

    // Check if is_primary column exists in product_images table
    const isPrimaryExists = await checkColumnInTable('product_images', 'is_primary');
    if (!isPrimaryExists) {
      console.log('➕ Adding is_primary column to product_images table');
      await pool.query(`ALTER TABLE product_images ADD COLUMN is_primary BOOLEAN DEFAULT FALSE`);
      console.log('✅ Column is_primary added to product_images table');
    } else {
      console.log('⏭️  Column is_primary already exists in product_images table, skipping');
    }

    // Check if product_variants table exists
    const checkTable = async (tableName) => {
      const result = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name = $1
      `, [tableName]);
      return result.rows.length > 0;
    };

    const variantsExists = await checkTable('product_variants');
    if (!variantsExists) {
      console.log('➕ Creating product_variants table...');
      await pool.query(`
        CREATE TABLE product_variants (
          id SERIAL PRIMARY KEY,
          product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
          color VARCHAR(50),
          size VARCHAR(50),
          storage VARCHAR(50),
          ram VARCHAR(50),
          stock INTEGER DEFAULT 0,
          price_adjustment DECIMAL(10, 2) DEFAULT 0.00
        )
      `);
      console.log('✅ product_variants table created successfully');
    } else {
      console.log('⏭️  product_variants table already exists, skipping');
    }

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateProductsTable().catch(console.error);
