const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkHeadphoneMouseMismatch() {
  try {
    console.log('🔍 Checking for headphone/mouse image mismatch in detail...\n');

    // Get all electronics products with headphone/earphone/audio in title
    const headphoneProducts = await pool.query(`
      SELECT p.id, p.title, p.thumbnail, pi.image_url, pi.public_id
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
      WHERE p.category = 'Electronics'
      AND (p.title ILIKE '%headphone%' OR p.title ILIKE '%earphone%' OR p.title ILIKE '%audio%' OR p.title ILIKE '%sound%')
      ORDER BY p.id
    `);

    console.log(`📦 Found ${headphoneProducts.rows.length} headphone/audio products\n`);

    for (const product of headphoneProducts.rows) {
      const thumbnail = product.thumbnail || product.image_url;
      const hasMouseInUrl = thumbnail && thumbnail.toLowerCase().includes('mouse');
      const hasMouseInPublicId = product.public_id && product.public_id.toLowerCase().includes('mouse');
      
      console.log(`[${product.id}] ${product.title.substring(0, 50)}...`);
      console.log(`   Thumbnail: ${thumbnail ? thumbnail.substring(0, 60) + '...' : 'NULL'}`);
      
      if (hasMouseInUrl || hasMouseInPublicId) {
        console.log(`   ⚠️  MOUSE IMAGE DETECTED!`);
      }
      console.log('');
    }

    // Also check for products with "mouse" in their image URLs but not in title
    console.log(`\n🔍 Checking for products with mouse images but not mouse titles...`);
    const mouseImageProducts = await pool.query(`
      SELECT p.id, p.title, p.thumbnail, pi.image_url
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
      WHERE (p.thumbnail ILIKE '%mouse%' OR pi.image_url ILIKE '%mouse%')
      AND p.title NOT ILIKE '%mouse%'
      ORDER BY p.id
    `);

    console.log(`📦 Found ${mouseImageProducts.rows.length} products with mouse images but not mouse titles:\n`);
    mouseImageProducts.rows.forEach(row => {
      console.log(`[${row.id}] ${row.title.substring(0, 50)}...`);
      console.log(`   Image: ${(row.thumbnail || row.image_url).substring(0, 60)}...`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkHeadphoneMouseMismatch();
