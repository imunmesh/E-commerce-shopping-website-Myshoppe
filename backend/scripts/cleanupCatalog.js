const { Pool } = require('pg');
const { v2: cloudinary } = require('cloudinary');
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

async function cleanupCatalog() {
  try {
    console.log('🧹 Starting full catalog cleanup...\n');

    const report = {
      productsDeleted: 0,
      variantsDeleted: 0,
      imagesDeleted: 0,
      cloudinaryAssetsRemoved: 0,
      duplicateProductsRemoved: 0,
      duplicateSkusRemoved: 0,
      orphanRecordsRemoved: 0
    };

    // 1. Count existing data before cleanup
    console.log('📊 Counting existing data...');
    const productCount = (await pool.query('SELECT COUNT(*) FROM products')).rows[0].count;
    const variantCount = (await pool.query('SELECT COUNT(*) FROM product_variants')).rows[0].count;
    const imageCount = (await pool.query('SELECT COUNT(*) FROM product_images')).rows[0].count;
    
    console.log(`   Products: ${productCount}`);
    console.log(`   Variants: ${variantCount}`);
    console.log(`   Images: ${imageCount}\n`);

    // 2. Remove orphan records (images without products, variants without products)
    console.log('🗑️  Removing orphan records...');
    const orphanImages = await pool.query(
      'DELETE FROM product_images WHERE product_id NOT IN (SELECT id FROM products) RETURNING *'
    );
    report.orphanRecordsRemoved += orphanImages.rowCount;
    console.log(`   Orphan images removed: ${orphanImages.rowCount}`);

    const orphanVariants = await pool.query(
      'DELETE FROM product_variants WHERE product_id NOT IN (SELECT id FROM products) RETURNING *'
    );
    report.orphanRecordsRemoved += orphanVariants.rowCount;
    console.log(`   Orphan variants removed: ${orphanVariants.rowCount}\n`);

    // 3. Remove duplicate products (by title + brand)
    console.log('🗑️  Removing duplicate products...');
    const duplicateProducts = await pool.query(`
      DELETE FROM products 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM products 
        GROUP BY title, brand
      )
      RETURNING id
    `);
    report.duplicateProductsRemoved = duplicateProducts.rowCount;
    console.log(`   Duplicate products removed: ${duplicateProducts.rowCount}\n`);

    // 4. Remove duplicate SKUs
    console.log('🗑️  Removing duplicate SKUs...');
    const duplicateSkus = await pool.query(`
      DELETE FROM products 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM products 
        WHERE sku IS NOT NULL 
        GROUP BY sku
      )
      RETURNING id
    `);
    report.duplicateSkusRemoved = duplicateSkus.rowCount;
    console.log(`   Duplicate SKUs removed: ${duplicateSkus.rowCount}\n`);

    // 5. Delete all product images from database
    console.log('🗑️  Deleting all product images from database...');
    const deletedImages = await pool.query('DELETE FROM product_images RETURNING id');
    report.imagesDeleted = deletedImages.rowCount;
    console.log(`   Images deleted from database: ${deletedImages.rowCount}\n`);

    // 6. Delete all product variants from database
    console.log('🗑️  Deleting all product variants from database...');
    const deletedVariants = await pool.query('DELETE FROM product_variants RETURNING id');
    report.variantsDeleted = deletedVariants.rowCount;
    console.log(`   Variants deleted from database: ${deletedVariants.rowCount}\n`);

    // 7. Delete all products from database
    console.log('🗑️  Deleting all products from database...');
    const deletedProducts = await pool.query('DELETE FROM products RETURNING id');
    report.productsDeleted = deletedProducts.rowCount;
    console.log(`   Products deleted from database: ${deletedProducts.rowCount}\n`);

    // 8. Clean up Cloudinary assets
    console.log('🗑️  Cleaning up Cloudinary assets...');
    try {
      // Delete all images in myshopee folder
      const result = await cloudinary.api.delete_resources_by_prefix('myshopee', {
        resource_type: 'image',
        type: 'upload'
      });
      
      if (result.deleted && result.deleted.length > 0) {
        report.cloudinaryAssetsRemoved = result.deleted.length;
        console.log(`   Cloudinary assets removed: ${result.deleted.length}`);
      } else {
        console.log('   No Cloudinary assets found to remove');
      }
    } catch (error) {
      console.log(`   Cloudinary cleanup warning: ${error.message}`);
    }

    // 9. Reset sequences
    console.log('\n🔄 Resetting sequences...');
    await pool.query('ALTER SEQUENCE products_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE product_images_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE product_variants_id_seq RESTART WITH 1');
    console.log('   Sequences reset successfully\n');

    // Print cleanup report
    console.log('='.repeat(80));
    console.log('📊 CLEANUP REPORT');
    console.log('='.repeat(80));
    console.log(`Products deleted: ${report.productsDeleted}`);
    console.log(`Variants deleted: ${report.variantsDeleted}`);
    console.log(`Images deleted: ${report.imagesDeleted}`);
    console.log(`Cloudinary assets removed: ${report.cloudinaryAssetsRemoved}`);
    console.log(`Duplicate products removed: ${report.duplicateProductsRemoved}`);
    console.log(`Duplicate SKUs removed: ${report.duplicateSkusRemoved}`);
    console.log(`Orphan records removed: ${report.orphanRecordsRemoved}`);
    console.log('='.repeat(80));

    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    const remainingProducts = (await pool.query('SELECT COUNT(*) FROM products')).rows[0].count;
    const remainingVariants = (await pool.query('SELECT COUNT(*) FROM product_variants')).rows[0].count;
    const remainingImages = (await pool.query('SELECT COUNT(*) FROM product_images')).rows[0].count;
    
    console.log(`   Remaining products: ${remainingProducts}`);
    console.log(`   Remaining variants: ${remainingVariants}`);
    console.log(`   Remaining images: ${remainingImages}`);
    
    if (remainingProducts === '0' && remainingVariants === '0' && remainingImages === '0') {
      console.log('\n✅ Cleanup successful - database is clean');
    } else {
      console.log('\n⚠️  Cleanup complete but some records remain');
    }

  } catch (error) {
    console.error('❌ Cleanup error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanupCatalog();
