const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function diagnoseCatalog() {
  try {
    console.log('🔍 Running catalog diagnostics...\n');

    // 1. Count total products
    const totalProducts = await pool.query('SELECT COUNT(*) FROM products');
    console.log(`📦 Total products: ${totalProducts.rows[0].count}`);

    // 2. Count distinct thumbnails
    const distinctThumbnails = await pool.query('SELECT COUNT(DISTINCT thumbnail) FROM products');
    console.log(`📦 Distinct thumbnails: ${distinctThumbnails.rows[0].count}`);

    // 3. Check for duplicate thumbnails
    const duplicateThumbnails = await pool.query(`
      SELECT thumbnail, COUNT(*) as count
      FROM products
      WHERE thumbnail IS NOT NULL
      GROUP BY thumbnail
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);
    
    console.log(`\n📊 Duplicate thumbnails (${duplicateThumbnails.rows.length} groups):`);
    duplicateThumbnails.rows.forEach(row => {
      console.log(`   ${row.thumbnail.substring(0, 60)}... - ${row.count} products`);
    });

    // 4. Check product_images table
    const totalImages = await pool.query('SELECT COUNT(*) FROM product_images');
    console.log(`\n📦 Total product_images records: ${totalImages.rows[0].count}`);

    const distinctImageUrls = await pool.query('SELECT COUNT(DISTINCT image_url) FROM product_images');
    console.log(`📦 Distinct image URLs: ${distinctImageUrls.rows[0].count}`);

    // 5. Check for junk titles
    const junkTitles = await pool.query(`
      SELECT title, COUNT(*) as count
      FROM products
      WHERE title ~* '^(kkk|new product|test|demo|sample|placeholder)$'
      GROUP BY title
      ORDER BY COUNT(*) DESC
    `);
    
    console.log(`\n📊 Junk titles (${junkTitles.rows.length} types):`);
    junkTitles.rows.forEach(row => {
      console.log(`   "${row.title}" - ${row.count} products`);
    });

    // 6. Check brand distribution
    const brandDistribution = await pool.query(`
      SELECT brand, COUNT(*) as count
      FROM products
      GROUP BY brand
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);
    
    console.log(`\n📊 Top 10 brands:`);
    brandDistribution.rows.forEach(row => {
      console.log(`   ${row.brand} - ${row.count} products`);
    });

    // 7. Sample product details
    const sampleProducts = await pool.query(`
      SELECT title, brand, category, thumbnail
      FROM products
      LIMIT 50
    `);
    
    console.log(`\n📄 Sample products (first 50):`);
    sampleProducts.rows.forEach((row, idx) => {
      console.log(`   [${idx + 1}] ${row.title.substring(0, 40)}... | ${row.brand} | ${row.category}`);
    });

    // 8. Check Cloudinary vs non-Cloudinary URLs
    const cloudinaryImages = await pool.query("SELECT COUNT(*) FROM product_images WHERE image_url LIKE '%cloudinary%'");
    const nonCloudinaryImages = await pool.query("SELECT COUNT(*) FROM product_images WHERE image_url NOT LIKE '%cloudinary%'");
    
    console.log(`\n📊 Image URL types:`);
    console.log(`   Cloudinary URLs: ${cloudinaryImages.rows[0].count}`);
    console.log(`   Non-Cloudinary URLs: ${nonCloudinaryImages.rows[0].count}`);

    // 9. Check if thumbnails are null
    const nullThumbnails = await pool.query('SELECT COUNT(*) FROM products WHERE thumbnail IS NULL');
    console.log(`\n📊 Products with NULL thumbnail: ${nullThumbnails.rows[0].count}`);

    // 10. Check external_product_id distribution
    const externalIdDistribution = await pool.query(`
      SELECT 
        CASE 
          WHEN external_product_id LIKE 'dummyjson-%' THEN 'DummyJSON'
          WHEN external_product_id LIKE 'fakestore-%' THEN 'FakeStore'
          WHEN external_product_id LIKE 'escuelajs-%' THEN 'Escuelajs'
          ELSE 'Other/None'
        END as source,
        COUNT(*) as count
      FROM products
      GROUP BY source
      ORDER BY count DESC
    `);
    
    console.log(`\n📊 Product sources:`);
    externalIdDistribution.rows.forEach(row => {
      console.log(`   ${row.source} - ${row.count} products`);
    });

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  } finally {
    await pool.end();
  }
}

diagnoseCatalog();
