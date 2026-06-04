const { Pool } = require('pg');
const { v2: cloudinary } = require('cloudinary');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create temp directory for downloads
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Download image from URL
const downloadImage = async (url, filename) => {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000
    });
    
    const filepath = path.join(tempDir, filename);
    const writer = fs.createWriteStream(filepath);
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filepath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`❌ Failed to download ${url}:`, error.message);
    throw error;
  }
};

// Upload image to Cloudinary
const uploadToCloudinary = async (filepath, publicId) => {
  try {
    const result = await cloudinary.uploader.upload(filepath, {
      public_id: publicId,
      folder: 'myshopee',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
    
    // Delete temp file after upload
    fs.unlinkSync(filepath);
    
    return result;
  } catch (error) {
    console.error(`❌ Failed to upload ${filepath}:`, error.message);
    // Clean up temp file even if upload fails
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    throw error;
  }
};

// Main migration function
async function migrateToCloudinary() {
  try {
    console.log('🚀 Starting Cloudinary migration...\n');

    // Get all product images with Unsplash URLs
    const imagesResult = await pool.query(
      `SELECT pi.id, pi.product_id, pi.image_url, pi.is_primary, p.category
       FROM product_images pi
       JOIN products p ON pi.product_id = p.id
       WHERE pi.image_url LIKE '%source.unsplash%'
       ORDER BY pi.product_id, pi.id`
    );
    
    const images = imagesResult.rows;
    console.log(`📦 Found ${images.length} images to migrate\n`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const progress = `📊 Progress: ${i + 1}/${images.length} (${((i + 1) / images.length * 100).toFixed(1)}%)`;
      
      try {
        // Generate unique public ID
        const publicId = `myshopee-product-${image.product_id}-img-${image.id}`;
        
        // Download image
        console.log(`${progress} - Downloading image ${image.id}...`);
        const filename = `temp-${image.id}.jpg`;
        const filepath = await downloadImage(image.image_url, filename);
        
        // Upload to Cloudinary
        console.log(`${progress} - Uploading to Cloudinary...`);
        const cloudinaryResult = await uploadToCloudinary(filepath, publicId);
        
        // Update database with Cloudinary URL
        const cloudinaryUrl = cloudinaryResult.secure_url;
        await pool.query(
          'UPDATE product_images SET image_url = $1, public_id = $2 WHERE id = $3',
          [cloudinaryUrl, cloudinaryResult.public_id, image.id]
        );
        
        successCount++;
        console.log(`${progress} - ✅ Migrated image ${image.id} to Cloudinary`);
        
        // Update product thumbnail if this is a primary image
        if (image.is_primary) {
          await pool.query(
            'UPDATE products SET thumbnail = $1 WHERE id = $2',
            [cloudinaryUrl, image.product_id]
          );
          console.log(`${progress} - ✅ Updated product ${image.product_id} thumbnail`);
        }
        
      } catch (error) {
        failCount++;
        console.error(`${progress} - ❌ Failed to migrate image ${image.id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(80));
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⏭️  Skipped: ${skipCount}`);
    console.log(`📦 Total processed: ${images.length}`);

    // Verification
    console.log('\n🔍 Verifying migration...\n');
    
    const cloudinaryCountResult = await pool.query(
      "SELECT COUNT(*) FROM product_images WHERE image_url LIKE '%res.cloudinary.com%'"
    );
    const cloudinaryCount = parseInt(cloudinaryCountResult.rows[0].count);
    
    console.log(`📊 Images with Cloudinary URLs: ${cloudinaryCount}`);
    
    if (cloudinaryCount >= 10) {
      console.log('✅ Verification passed: At least 10 records contain Cloudinary URLs');
      
      // Show sample Cloudinary URLs
      const sampleResult = await pool.query(
        "SELECT image_url FROM product_images WHERE image_url LIKE '%res.cloudinary.com%' LIMIT 5"
      );
      console.log('\n📄 Sample Cloudinary URLs:');
      sampleResult.rows.forEach((row, idx) => {
        console.log(`  [${idx + 1}] ${row.image_url}`);
      });
    } else {
      console.log('❌ Verification failed: Less than 10 records contain Cloudinary URLs');
    }

    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('\n🧹 Cleaned up temporary files');
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateToCloudinary().catch(console.error);
