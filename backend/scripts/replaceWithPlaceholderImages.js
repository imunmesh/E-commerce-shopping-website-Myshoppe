const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Generate reliable placeholder image URLs using picsum.photos
const generatePlaceholderUrl = (productId, imageId, width = 800, height = 800) => {
  // Using picsum.photos which is a reliable placeholder image service
  // Adding random seed to ensure different images for different products
  const seed = `${productId}-${imageId}`;
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
};

async function replaceWithPlaceholderImages() {
  try {
    console.log('🔄 Replacing dead Unsplash URLs with reliable placeholder images...\n');

    // Get all product images
    const imagesResult = await pool.query(
      `SELECT pi.id, pi.product_id, pi.is_primary, p.category
       FROM product_images pi
       JOIN products p ON pi.product_id = p.id
       ORDER BY pi.product_id, pi.id`
    );
    
    const images = imagesResult.rows;
    console.log(`📦 Found ${images.length} images to update\n`);

    let updatedCount = 0;

    for (const image of images) {
      // Generate new placeholder URL
      const newImageUrl = generatePlaceholderUrl(image.product_id, image.id);
      
      // Update product_images table
      await pool.query(
        'UPDATE product_images SET image_url = $1, public_id = $2 WHERE id = $3',
        [newImageUrl, `placeholder-product-${image.product_id}-img-${image.id}`, image.id]
      );

      // Update product thumbnail if this is a primary image
      if (image.is_primary) {
        await pool.query(
          'UPDATE products SET thumbnail = $1 WHERE id = $2',
          [newImageUrl, image.product_id]
        );
      }

      updatedCount++;
      if (updatedCount % 500 === 0) {
        console.log(`📊 Updated ${updatedCount}/${images.length} images...`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} images with placeholder URLs`);

    // Verification
    console.log('\n🔍 Verifying update...\n');
    
    const placeholderCountResult = await pool.query(
      "SELECT COUNT(*) FROM product_images WHERE image_url LIKE '%picsum.photos%'"
    );
    const placeholderCount = parseInt(placeholderCountResult.rows[0].count);
    
    console.log(`📊 Images with placeholder URLs: ${placeholderCount}`);
    
    if (placeholderCount >= 10) {
      console.log('✅ Verification passed: At least 10 records contain placeholder URLs');
      
      // Show sample placeholder URLs
      const sampleResult = await pool.query(
        "SELECT image_url FROM product_images WHERE image_url LIKE '%picsum.photos%' LIMIT 5"
      );
      console.log('\n📄 Sample placeholder URLs:');
      sampleResult.rows.forEach((row, idx) => {
        console.log(`  [${idx + 1}] ${row.image_url}`);
      });
    } else {
      console.log('❌ Verification failed: Less than 10 records contain placeholder URLs');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

replaceWithPlaceholderImages();
