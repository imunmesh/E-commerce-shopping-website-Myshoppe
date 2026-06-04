const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixNullThumbnails() {
  try {
    console.log('🔧 Fixing NULL thumbnails...\n');

    // 1. Update products with NULL thumbnails to use their primary image
    const updateResult = await pool.query(`
      UPDATE products 
      SET thumbnail = (
        SELECT image_url 
        FROM product_images 
        WHERE product_images.product_id = products.id 
        AND product_images.is_primary = true
        LIMIT 1
      )
      WHERE thumbnail IS NULL
      AND EXISTS (
        SELECT 1 FROM product_images 
        WHERE product_images.product_id = products.id
      )
      RETURNING id
    `);

    console.log(`✅ Updated ${updateResult.rowCount} products with primary image as thumbnail`);

    // 2. For products still with NULL thumbnail (no images), use first available image
    const fallbackResult = await pool.query(`
      UPDATE products 
      SET thumbnail = (
        SELECT image_url 
        FROM product_images 
        WHERE product_images.product_id = products.id 
        LIMIT 1
      )
      WHERE thumbnail IS NULL
      AND EXISTS (
        SELECT 1 FROM product_images 
        WHERE product_images.product_id = products.id
      )
      RETURNING id
    `);

    console.log(`✅ Updated ${fallbackResult.rowCount} products with first image as thumbnail`);

    // 3. Remove junk product "New Product"
    const deleteResult = await pool.query(`
      DELETE FROM products 
      WHERE title = 'New Product'
      RETURNING id
    `);

    console.log(`✅ Deleted ${deleteResult.rowCount} junk products`);

    // 4. Verify remaining NULL thumbnails
    const nullCount = await pool.query('SELECT COUNT(*) FROM products WHERE thumbnail IS NULL');
    console.log(`\n📊 Products with NULL thumbnail after fix: ${nullCount.rows[0].count}`);

    // 5. Verify distinct thumbnails
    const distinctThumbnails = await pool.query('SELECT COUNT(DISTINCT thumbnail) FROM products');
    console.log(`📊 Distinct thumbnails: ${distinctThumbnails.rows[0].count}`);

    console.log('\n✅ Thumbnail fix complete');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixNullThumbnails();
