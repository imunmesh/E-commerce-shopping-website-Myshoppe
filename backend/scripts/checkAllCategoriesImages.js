const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAllCategoriesImages() {
  try {
    console.log('🔍 Checking all categories for NULL images...\n');

    // Get all categories
    const categoriesResult = await pool.query(`
      SELECT DISTINCT category FROM products ORDER BY category
    `);
    
    const categories = categoriesResult.rows.map(row => row.category);
    console.log(`📦 Found ${categories.length} categories\n`);

    // Check each category
    for (const category of categories) {
      console.log(`\n📂 Category: ${category}`);
      
      // Get first 20 products (2 pages at 10 per page)
      const products = await pool.query(`
        SELECT id, title, brand, thumbnail, external_product_id
        FROM products
        WHERE category = $1
        ORDER BY id
        LIMIT 20
      `, [category]);

      let nullCount = 0;
      let validCount = 0;

      for (const product of products.rows) {
        const hasNullThumbnail = product.thumbnail === null;
        
        if (hasNullThumbnail) {
          nullCount++;
          console.log(`   ❌ [${product.id}] ${product.title.substring(0, 35)}... - NULL thumbnail (${product.external_product_id})`);
        } else {
          validCount++;
          // Check for headphone/mouse mismatch
          if (category === 'Electronics' && 
              (product.title.toLowerCase().includes('headphone') || 
               product.title.toLowerCase().includes('earphone') ||
               product.title.toLowerCase().includes('audio'))) {
            if (product.thumbnail.toLowerCase().includes('mouse')) {
              console.log(`   ⚠️  [${product.id}] ${product.title.substring(0, 35)}... - MOUSE IMAGE MISMATCH`);
            }
          }
        }
      }

      console.log(`   📊 Valid: ${validCount}, NULL: ${nullCount}`);
    }

    // Overall summary
    const totalNull = await pool.query('SELECT COUNT(*) FROM products WHERE thumbnail IS NULL');
    const totalProducts = await pool.query('SELECT COUNT(*) FROM products');
    
    console.log(`\n📊 Overall Summary:`);
    console.log(`   Total products: ${totalProducts.rows[0].count}`);
    console.log(`   Products with NULL thumbnail: ${totalNull.rows[0].count}`);

    // Check for specific headphone/mouse issue
    console.log(`\n🔍 Checking for headphone/mouse image mismatch...`);
    const headphoneMouseMismatch = await pool.query(`
      SELECT id, title, thumbnail
      FROM products
      WHERE category = 'Electronics'
      AND (title ILIKE '%headphone%' OR title ILIKE '%earphone%' OR title ILIKE '%audio%')
      AND thumbnail ILIKE '%mouse%'
    `);
    
    if (headphoneMouseMismatch.rows.length > 0) {
      console.log(`   ⚠️  Found ${headphoneMouseMismatch.rows.length} headphone products with mouse images:`);
      headphoneMouseMismatch.rows.forEach(row => {
        console.log(`      [${row.id}] ${row.title}`);
      });
    } else {
      console.log(`   ✅ No headphone/mouse image mismatches found`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkAllCategoriesImages();
