const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkElectronicsImages() {
  try {
    console.log('🔍 Checking electronics products for NULL images...\n');

    // Get electronics products
    const electronicsProducts = await pool.query(`
      SELECT id, title, brand, category, thumbnail, external_product_id
      FROM products
      WHERE category = 'Electronics'
      ORDER BY id
      LIMIT 50
    `);

    console.log(`📦 Found ${electronicsProducts.rows.length} electronics products\n`);

    // Check each product for thumbnail and images
    for (const product of electronicsProducts.rows) {
      const imageCount = await pool.query(
        'SELECT COUNT(*) FROM product_images WHERE product_id = $1',
        [product.id]
      );
      
      const hasNullThumbnail = product.thumbnail === null;
      const hasImages = parseInt(imageCount.rows[0].count) > 0;
      
      console.log(`   [${product.id}] ${product.title.substring(0, 40)}...`);
      console.log(`       Thumbnail: ${hasNullThumbnail ? '❌ NULL' : '✅ ' + product.thumbnail.substring(0, 50) + '...'}`);
      console.log(`       Images in DB: ${imageCount.rows[0].count}`);
      console.log(`       Source: ${product.external_product_id}`);
      console.log('');
    }

    // Count NULL thumbnails in electronics
    const nullThumbnails = await pool.query(`
      SELECT COUNT(*) FROM products 
      WHERE category = 'Electronics' AND thumbnail IS NULL
    `);
    console.log(`📊 Electronics with NULL thumbnail: ${nullThumbnails.rows[0].count}`);

    // Count electronics products without any images
    const noImages = await pool.query(`
      SELECT COUNT(DISTINCT p.id) 
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.category = 'Electronics' AND pi.product_id IS NULL
    `);
    console.log(`📊 Electronics without any images: ${noImages.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkElectronicsImages();
