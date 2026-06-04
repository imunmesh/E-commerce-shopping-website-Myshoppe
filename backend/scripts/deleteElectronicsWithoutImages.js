const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function deleteElectronicsWithoutImages() {
  try {
    console.log('🗑️  Deleting electronics products without images...\n');

    // Delete electronics products with NULL thumbnails (no images)
    const deleteResult = await pool.query(`
      DELETE FROM products 
      WHERE category = 'Electronics' AND thumbnail IS NULL
      RETURNING id, title, external_product_id
    `);

    console.log(`✅ Deleted ${deleteResult.rowCount} electronics products without images:`);
    deleteResult.rows.forEach(row => {
      console.log(`   [${row.id}] ${row.title.substring(0, 40)}... (${row.external_product_id})`);
    });

    // Verify remaining electronics
    const remainingElectronics = await pool.query(`
      SELECT COUNT(*) FROM products WHERE category = 'Electronics'
    `);
    const nullThumbnails = await pool.query(`
      SELECT COUNT(*) FROM products 
      WHERE category = 'Electronics' AND thumbnail IS NULL
    `);

    console.log(`\n📊 After cleanup:`);
    console.log(`   Remaining electronics: ${remainingElectronics.rows[0].count}`);
    console.log(`   Electronics with NULL thumbnail: ${nullThumbnails.rows[0].count}`);

    if (parseInt(nullThumbnails.rows[0].count) === 0) {
      console.log('\n✅ Cleanup successful - all remaining electronics have images');
    } else {
      console.log('\n⚠️  Some electronics still have NULL thumbnails');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

deleteElectronicsWithoutImages();
