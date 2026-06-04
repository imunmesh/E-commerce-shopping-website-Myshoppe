const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function deleteIncompleteProducts() {
  try {
    console.log('🗑️  Deleting incomplete products (no images)...\n');

    // 1. Delete products with NULL thumbnails (no images)
    const deleteResult = await pool.query(`
      DELETE FROM products 
      WHERE thumbnail IS NULL
      RETURNING id, title, external_product_id
    `);

    console.log(`✅ Deleted ${deleteResult.rowCount} incomplete products:`);
    deleteResult.rows.forEach(row => {
      console.log(`   [${row.id}] ${row.title.substring(0, 40)}... (${row.external_product_id})`);
    });

    // 2. Verify remaining products
    const remainingProducts = await pool.query('SELECT COUNT(*) FROM products');
    const remainingImages = await pool.query('SELECT COUNT(*) FROM product_images');
    const nullThumbnails = await pool.query('SELECT COUNT(*) FROM products WHERE thumbnail IS NULL');

    console.log(`\n📊 After cleanup:`);
    console.log(`   Remaining products: ${remainingProducts.rows[0].count}`);
    console.log(`   Remaining images: ${remainingImages.rows[0].count}`);
    console.log(`   Products with NULL thumbnail: ${nullThumbnails.rows[0].count}`);

    // 3. Verify all remaining products have images
    const productsWithImages = await pool.query(`
      SELECT COUNT(DISTINCT product_id) FROM product_images
    `);

    console.log(`   Products with images: ${productsWithImages.rows[0].count}`);

    if (parseInt(nullThumbnails.rows[0].count) === 0) {
      console.log('\n✅ Cleanup successful - all remaining products have images');
    } else {
      console.log('\n⚠️  Some products still have NULL thumbnails');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

deleteIncompleteProducts();
