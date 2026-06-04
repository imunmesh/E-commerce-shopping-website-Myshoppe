const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function deleteShoesWithoutImages() {
  try {
    console.log('🗑️  Deleting shoes products without images...\n');

    // Delete shoes products with NULL thumbnails (no images)
    const deleteResult = await pool.query(`
      DELETE FROM products 
      WHERE category = 'Shoes' AND thumbnail IS NULL
      RETURNING id, title, external_product_id
    `);

    console.log(`✅ Deleted ${deleteResult.rowCount} shoes products without images:`);
    deleteResult.rows.forEach(row => {
      console.log(`   [${row.id}] ${row.title.substring(0, 40)}... (${row.external_product_id})`);
    });

    // Verify remaining shoes
    const remainingShoes = await pool.query(`
      SELECT COUNT(*) FROM products WHERE category = 'Shoes'
    `);
    const nullThumbnails = await pool.query(`
      SELECT COUNT(*) FROM products 
      WHERE category = 'Shoes' AND thumbnail IS NULL
    `);

    console.log(`\n📊 After cleanup:`);
    console.log(`   Remaining shoes: ${remainingShoes.rows[0].count}`);
    console.log(`   Shoes with NULL thumbnail: ${nullThumbnails.rows[0].count}`);

    // Overall check
    const totalNull = await pool.query('SELECT COUNT(*) FROM products WHERE thumbnail IS NULL');
    console.log(`\n📊 Overall products with NULL thumbnail: ${totalNull.rows[0].count}`);

    if (parseInt(nullThumbnails.rows[0].count) === 0 && parseInt(totalNull.rows[0].count) === 0) {
      console.log('\n✅ Cleanup successful - all products have images');
    } else {
      console.log('\n⚠️  Some products still have NULL thumbnails');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

deleteShoesWithoutImages();
