const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Category-specific Pexels image URLs (reliable, working URLs)
const CATEGORY_IMAGES = {
  "Men's Clothing": [
    'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/297933/pexels-photo-297933.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1596558/pexels-photo-1596558.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3258762/pexels-photo-3258762.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/428340/pexels-photo-428340.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Women's Clothing": [
    'https://images.pexels.com/photos/1545205/pexels-photo-1545205.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/236915/pexels-photo-236915.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/279731/pexels-photo-279731.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7622456/pexels-photo-7622456.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Shoes": [
    'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1464625/pexels-photo-1464625.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2043590/pexels-photo-2043590.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/159646/pexels-photo-159646.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1123262/pexels-photo-1123262.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Watches": [
    'https://images.pexels.com/photos/278887/pexels-photo-278887.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1522773/pexels-photo-1522773.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/125779/pexels-photo-125779.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/190821/pexels-photo-190821.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/280250/pexels-photo-280250.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Bags": [
    'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/704569/pexels-photo-704569.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/158061/pexels-photo-158061.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/442826/pexels-photo-442826.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2290907/pexels-photo-2290907.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Electronics": [
    'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184461/pexels-photo-3184461.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Smartphones": [
    'https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1511705/pexels-photo-1511705.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1264200/pexels-photo-1264200.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2858185/pexels-photo-2858185.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Laptops": [
    'https://images.pexels.com/photos/18105/pexels-photo-18105.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/205421/pexels-photo-205421.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184290/pexels-photo-3184290.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184405/pexels-photo-3184405.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184311/pexels-photo-3184311.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Headphones": [
    'https://images.pexels.com/photos/3581895/pexels-photo-3581895.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3059900/pexels-photo-3059900.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/162648/pexels-photo-162648.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1508666/pexels-photo-1508666.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/573299/pexels-photo-573299.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Gaming": [
    'https://images.pexels.com/photos/3115222/pexels-photo-3115222.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/276717/pexels-photo-276717.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1174912/pexels-photo-1174912.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/33070/pexels-photo-33070.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/159821/pexels-photo-159821.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Beauty & Cosmetics": [
    'https://images.pexels.com/photos/2115779/pexels-photo-2115779.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3197905/pexels-photo-3197905.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2114984/pexels-photo-2114984.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3962293/pexels-photo-3962293.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Home & Kitchen": [
    'https://images.pexels.com/photos/3965502/pexels-photo-3965502.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3965650/pexels-photo-3965650.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3965648/pexels-photo-3965648.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3965644/pexels-photo-3965644.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3965638/pexels-photo-3965638.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Furniture": [
    'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/276583/pexels-photo-276583.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2082090/pexels-photo-2082090.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1567041/pexels-photo-1567041.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/279746/pexels-photo-279746.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Sports & Fitness": [
    'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/4664164/pexels-photo-4664164.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/4240256/pexels-photo-4240256.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3861966/pexels-photo-3861966.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3258526/pexels-photo-3258526.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Books": [
    'https://images.pexels.com/photos/256453/pexels-photo-256453.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1059280/pexels-photo-1059280.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2076924/pexels-photo-2076924.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/159848/pexels-photo-159848.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/301920/pexels-photo-301920.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  "Toys & Kids": [
    'https://images.pexels.com/photos/264647/pexels-photo-264647.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/406028/pexels-photo-406028.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/475388/pexels-photo-475388.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/678726/pexels-photo-678726.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/161634/pexels-photo-161634.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]
};

async function assignCategoryImages() {
  try {
    console.log('🔄 Assigning category-specific Pexels images...\n');

    // Get all products with their categories
    const productsResult = await pool.query('SELECT id, category FROM products ORDER BY id');
    const products = productsResult.rows;
    console.log(`📦 Found ${products.length} products\n`);

    let updatedCount = 0;

    for (const product of products) {
      const categoryImages = CATEGORY_IMAGES[product.category] || CATEGORY_IMAGES['Electronics'];
      
      // Delete existing images for this product
      await pool.query('DELETE FROM product_images WHERE product_id = $1', [product.id]);
      
      // Insert new category-specific images (3-5 images per product)
      const numImages = Math.floor(Math.random() * 3) + 3; // 3-5 images
      for (let i = 0; i < numImages; i++) {
        const imageUrl = categoryImages[i % categoryImages.length];
        await pool.query(
          `INSERT INTO product_images (product_id, image_url, public_id, is_primary)
           VALUES ($1, $2, $3, $4)`,
          [product.id, imageUrl, `pexels-${product.category.replace(/\s+/g, '-')}-${i}`, i === 0]
        );
      }
      
      // Update product thumbnail with first (primary) image
      await pool.query(
        'UPDATE products SET thumbnail = $1 WHERE id = $2',
        [categoryImages[0], product.id]
      );

      updatedCount++;
      if (updatedCount % 500 === 0) {
        console.log(`📊 Updated ${updatedCount}/${products.length} products...`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} products with category-specific images`);

    // Verification
    console.log('\n🔍 Verifying update...\n');
    
    const pexelsCountResult = await pool.query(
      "SELECT COUNT(*) FROM product_images WHERE image_url LIKE '%pexels%'"
    );
    const pexelsCount = parseInt(pexelsCountResult.rows[0].count);
    
    console.log(`📊 Images with Pexels URLs: ${pexelsCount}`);
    
    if (pexelsCount >= 10) {
      console.log('✅ Verification passed: At least 10 records contain Pexels URLs');
      
      // Show sample Pexels URLs by category
      const sampleResult = await pool.query(
        `SELECT DISTINCT p.category, pi.image_url 
         FROM product_images pi 
         JOIN products p ON pi.product_id = p.id 
         WHERE pi.image_url LIKE '%pexels%' 
         ORDER BY p.category 
         LIMIT 10`
      );
      console.log('\n📄 Sample Pexels URLs by category:');
      sampleResult.rows.forEach((row, idx) => {
        console.log(`  [${idx + 1}] ${row.category}: ${row.image_url.substring(0, 80)}...`);
      });
    } else {
      console.log('❌ Verification failed: Less than 10 records contain Pexels URLs');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

assignCategoryImages();
