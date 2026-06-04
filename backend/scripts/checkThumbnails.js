const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkThumbnails() {
  try {
    console.log('🔍 Checking product thumbnails...\n');

    // Check products table for thumbnails
    const productsResult = await pool.query(
      'SELECT id, title, thumbnail FROM products LIMIT 10'
    );
    
    console.log('📦 Products table (thumbnail field):');
    console.log('─'.repeat(80));
    productsResult.rows.forEach(product => {
      console.log(`ID: ${product.id}`);
      console.log(`Title: ${product.title}`);
      console.log(`Thumbnail: ${product.thumbnail || 'NULL'}`);
      console.log('─'.repeat(80));
    });

    // Check product_images table
    const imagesResult = await pool.query(
      `SELECT p.id, p.title, pi.image_url, pi.is_primary 
       FROM products p 
       LEFT JOIN product_images pi ON p.id = pi.product_id 
       WHERE p.id <= 5 
       ORDER BY p.id, pi.is_primary DESC`
    );
    
    console.log('\n🖼️  Product images table:');
    console.log('─'.repeat(80));
    imagesResult.rows.forEach(img => {
      console.log(`Product ID: ${img.id}`);
      console.log(`Title: ${img.title}`);
      console.log(`Image URL: ${img.image_url || 'NULL'}`);
      console.log(`Is Primary: ${img.is_primary}`);
      console.log('─'.repeat(80));
    });

    // Count products with/without thumbnails
    const countResult = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(thumbnail) as with_thumbnail,
         COUNT(*) - COUNT(thumbnail) as without_thumbnail
       FROM products`
    );
    
    console.log('\n📊 Thumbnail statistics:');
    console.log('─'.repeat(80));
    console.log(`Total products: ${countResult.rows[0].total}`);
    console.log(`With thumbnail: ${countResult.rows[0].with_thumbnail}`);
    console.log(`Without thumbnail: ${countResult.rows[0].without_thumbnail}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkThumbnails();
