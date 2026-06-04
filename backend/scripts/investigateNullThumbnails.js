const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function investigateNullThumbnails() {
  try {
    console.log('🔍 Investigating products with NULL thumbnails...\n');

    // 1. Get products with NULL thumbnails
    const nullThumbnailProducts = await pool.query(`
      SELECT id, title, brand, category, external_product_id
      FROM products
      WHERE thumbnail IS NULL
      ORDER BY id
    `);

    console.log(`📦 Products with NULL thumbnails: ${nullThumbnailProducts.rows.length}\n`);

    // 2. Check if these products have any images in product_images
    for (const product of nullThumbnailProducts.rows) {
      const imageCount = await pool.query(
        'SELECT COUNT(*) FROM product_images WHERE product_id = $1',
        [product.id]
      );
      
      console.log(`   [${product.id}] ${product.title.substring(0, 40)}... | Images: ${imageCount.rows[0].count} | Source: ${product.external_product_id}`);
    }

    // 3. Count products by external source
    const sourceCount = await pool.query(`
      SELECT 
        CASE 
          WHEN external_product_id LIKE 'dummyjson-%' THEN 'DummyJSON'
          WHEN external_product_id LIKE 'fakestore-%' THEN 'FakeStore'
          WHEN external_product_id LIKE 'escuelajs-%' THEN 'Escuelajs'
          ELSE 'Other/None'
        END as source,
        COUNT(*) as count
      FROM products
      WHERE thumbnail IS NULL
      GROUP BY source
    `);

    console.log(`\n📊 NULL thumbnail products by source:`);
    sourceCount.rows.forEach(row => {
      console.log(`   ${row.source} - ${row.count} products`);
    });

    // 4. Check total images vs products
    const totalProducts = await pool.query('SELECT COUNT(*) FROM products');
    const totalImages = await pool.query('SELECT COUNT(*) FROM product_images');
    const productsWithImages = await pool.query(`
      SELECT COUNT(DISTINCT product_id) FROM product_images
    `);

    console.log(`\n📊 Image statistics:`);
    console.log(`   Total products: ${totalProducts.rows[0].count}`);
    console.log(`   Total images: ${totalImages.rows[0].count}`);
    console.log(`   Products with images: ${productsWithImages.rows[0].count}`);
    console.log(`   Products without images: ${totalProducts.rows[0].count - productsWithImages.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

investigateNullThumbnails();
