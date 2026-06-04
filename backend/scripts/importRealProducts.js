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

// API Endpoints
const API_ENDPOINTS = {
  dummyjson: 'https://dummyjson.com/products',
  fakestore: 'https://fakestoreapi.com/products',
  escuelajs: 'https://api.escuelajs.co/api/v1/products'
};

// Category mapping for consistency
const CATEGORY_MAPPING = {
  "men's clothing": "Men's Clothing",
  "women's clothing": "Women's Clothing",
  "jewelery": "Jewelry",
  "electronics": "Electronics",
  "smartphones": "Smartphones",
  "laptops": "Laptops",
  "fragrances": "Beauty & Cosmetics",
  "skincare": "Beauty & Cosmetics",
  "groceries": "Home & Kitchen",
  "home-decoration": "Home & Kitchen",
  "furniture": "Furniture",
  "tops": "Women's Clothing",
  "womens-dresses": "Women's Clothing",
  "womens-shoes": "Shoes",
  "mens-shirts": "Men's Clothing",
  "mens-shoes": "Shoes",
  "mens-watches": "Watches",
  "womens-watches": "Watches",
  "womens-bags": "Bags",
  "womens-jewellery": "Jewelry",
  "sunglasses": "Accessories",
  "automotive": "Electronics",
  "motorcycle": "Electronics",
  "lighting": "Home & Kitchen"
};

// Normalize category
const normalizeCategory = (category) => {
  if (!category) return 'Electronics';
  const lowerCategory = category.toLowerCase();
  return CATEGORY_MAPPING[lowerCategory] || 
         Object.values(CATEGORY_MAPPING).find(c => c.toLowerCase().includes(lowerCategory)) ||
         'Electronics';
};

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
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    
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

// Fetch products from DummyJSON with pagination
async function fetchDummyJSON() {
  try {
    console.log('📦 Fetching products from DummyJSON with pagination...');
    const allProducts = [];
    let skip = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore && allProducts.length < 200) {
      const response = await axios.get(`${API_ENDPOINTS.dummyjson}?limit=${limit}&skip=${skip}`, { timeout: 30000 });
      const products = response.data.products || [];
      
      if (products.length === 0) {
        hasMore = false;
        break;
      }

      allProducts.push(...products);
      skip += limit;
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (skip >= response.data.total) {
        hasMore = false;
      }
    }
    
    console.log(`   Fetched ${allProducts.length} products from DummyJSON`);
    
    return allProducts.map(p => ({
      external_id: `dummyjson-${p.id}`,
      title: p.title,
      description: p.description || `${p.brand || 'Generic'} ${p.title} - Quality product from MyShopee`,
      category: normalizeCategory(p.category),
      brand: p.brand || 'Generic',
      price: p.price,
      discount: p.discountPercentage || 0,
      stock: p.stock || 50,
      rating: p.rating || 4.0,
      thumbnail: p.thumbnail,
      images: p.images || [p.thumbnail]
    }));
  } catch (error) {
    console.error('❌ DummyJSON fetch error:', error.message);
    return [];
  }
}

// Fetch products from FakeStore API
async function fetchFakeStore() {
  try {
    console.log('📦 Fetching products from FakeStore API...');
    const response = await axios.get(API_ENDPOINTS.fakestore, { timeout: 30000 });
    const products = response.data || [];
    
    console.log(`   Fetched ${products.length} products from FakeStore`);
    
    return products.map(p => ({
      external_id: `fakestore-${p.id}`,
      title: p.title,
      description: p.description || `${p.title} - Quality product from MyShopee`,
      category: normalizeCategory(p.category),
      brand: 'Generic',
      price: p.price,
      discount: 0,
      stock: 50,
      rating: Math.round(p.rating.rate * 2) / 2 || 4.0,
      thumbnail: p.image,
      images: [p.image]
    }));
  } catch (error) {
    console.error('❌ FakeStore fetch error:', error.message);
    return [];
  }
}

// Fetch products from Escuelajs API with pagination
async function fetchEscuelajs() {
  try {
    console.log('📦 Fetching products from Escuelajs API with pagination...');
    const allProducts = [];
    let page = 1;
    const limit = 50;
    let hasMore = true;

    while (hasMore && allProducts.length < 200) {
      const response = await axios.get(`${API_ENDPOINTS.escuelajs}?offset=${(page - 1) * limit}&limit=${limit}`, { timeout: 30000 });
      const products = response.data || [];
      
      if (products.length === 0) {
        hasMore = false;
        break;
      }

      allProducts.push(...products);
      page++;
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (products.length < limit) {
        hasMore = false;
      }
    }
    
    console.log(`   Fetched ${allProducts.length} products from Escuelajs`);
    
    return allProducts.map(p => ({
      external_id: `escuelajs-${p.id}`,
      title: p.title,
      description: p.description || `${p.brand || 'Generic'} ${p.title} - Quality product from MyShopee`,
      category: normalizeCategory(p.category?.name),
      brand: p.brand || 'Generic',
      price: p.price,
      discount: 0,
      stock: 50,
      rating: 4.0,
      thumbnail: p.images?.[0] || '',
      images: p.images || []
    }));
  } catch (error) {
    console.error('❌ Escuelajs fetch error:', error.message);
    return [];
  }
}

// Main import function
async function importRealProducts() {
  const report = {
    productsImported: 0,
    categoriesImported: new Set(),
    variantsImported: 0,
    imagesImported: 0,
    failedImports: 0,
    failedImageUrls: [],
    duplicateSkipped: 0
  };

  try {
    console.log('🚀 Starting real product import...\n');

    // Fetch products from all APIs
    const [dummyjsonProducts, fakestoreProducts, escuelajsProducts] = await Promise.all([
      fetchDummyJSON(),
      fetchFakeStore(),
      fetchEscuelajs()
    ]);

    const allProducts = [...dummyjsonProducts, ...fakestoreProducts, ...escuelajsProducts];
    console.log(`📦 Total products fetched: ${allProducts.length}\n`);

    // Remove duplicates by external_id
    const uniqueProducts = new Map();
    allProducts.forEach(p => {
      if (!uniqueProducts.has(p.external_id)) {
        uniqueProducts.set(p.external_id, p);
      }
    });
    const deduplicatedProducts = Array.from(uniqueProducts.values());
    console.log(`📦 After deduplication: ${deduplicatedProducts.length}\n`);

    // Import products
    for (let i = 0; i < deduplicatedProducts.length; i++) {
      const product = deduplicatedProducts[i];
      const progress = `📊 Progress: ${i + 1}/${deduplicatedProducts.length} (${((i + 1) / deduplicatedProducts.length * 100).toFixed(1)}%)`;

      try {
        // Check if product already exists
        const existing = await pool.query(
          'SELECT id FROM products WHERE external_product_id = $1',
          [product.external_id]
        );

        if (existing.rows.length > 0) {
          report.duplicateSkipped++;
          console.log(`${progress} - ⏭️  Skipped duplicate: ${product.title}`);
          continue;
        }

        // Generate SKU
        const sku = `${product.category.substring(0, 3).toUpperCase()}-${product.external_id.split('-')[1]}`;

        // Insert product
        const productResult = await pool.query(
          `INSERT INTO products (title, description, category, brand, price, discount, rating, stock, sku, external_product_id, thumbnail)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            product.title,
            product.description,
            product.category,
            product.brand,
            product.price,
            product.discount,
            product.rating,
            product.stock,
            sku,
            product.external_id,
            null // Will be updated after image upload
          ]
        );

        const productId = productResult.rows[0].id;
        report.categoriesImported.add(product.category);

        // Process images (limit to 5 images per product)
        const imagesToProcess = product.images.slice(0, 5);
        let primaryImageUrl = null;

        for (let imgIdx = 0; imgIdx < imagesToProcess.length; imgIdx++) {
          const imageUrl = imagesToProcess[imgIdx];
          
          if (!imageUrl || imageUrl.length === 0) continue;

          try {
            const filename = `temp-${productId}-${imgIdx}.jpg`;
            const filepath = await downloadImage(imageUrl, filename);
            
            const publicId = `myshopee-product-${productId}-img-${imgIdx}`;
            const cloudinaryResult = await uploadToCloudinary(filepath, publicId);
            
            const cloudinaryUrl = cloudinaryResult.secure_url;
            const isPrimary = imgIdx === 0;

            // Insert image
            await pool.query(
              `INSERT INTO product_images (product_id, image_url, public_id, is_primary)
               VALUES ($1, $2, $3, $4)`,
              [productId, cloudinaryUrl, cloudinaryResult.public_id, isPrimary]
            );

            if (isPrimary) {
              primaryImageUrl = cloudinaryUrl;
            }

            report.imagesImported++;
          } catch (error) {
            console.error(`${progress} - ❌ Failed to process image ${imgIdx}: ${error.message}`);
            report.failedImageUrls.push(imageUrl);
          }
        }

        // Update product thumbnail with primary image
        if (primaryImageUrl) {
          await pool.query(
            'UPDATE products SET thumbnail = $1 WHERE id = $2',
            [primaryImageUrl, productId]
          );
        }

        report.productsImported++;
        console.log(`${progress} - ✅ Imported: ${product.title}`);

      } catch (error) {
        report.failedImports++;
        console.error(`${progress} - ❌ Failed to import ${product.title}:`, error.message);
      }
    }

    // Print import report
    console.log('\n' + '='.repeat(80));
    console.log('📊 IMPORT REPORT');
    console.log('='.repeat(80));
    console.log(`Total fetched: ${deduplicatedProducts.length}`);
    console.log(`Total deduplicated: ${deduplicatedProducts.length - report.productsImported - report.duplicateSkipped}`);
    console.log(`Total imported: ${report.productsImported}`);
    console.log(`Total Cloudinary uploads: ${report.imagesImported}`);
    console.log(`Categories imported: ${report.categoriesImported.size}`);
    console.log(`Categories: ${Array.from(report.categoriesImported).join(', ')}`);
    console.log(`Failed imports: ${report.failedImports}`);
    console.log(`Duplicate products skipped: ${report.duplicateSkipped}`);
    console.log(`Failed image URLs: ${report.failedImageUrls.length}`);
    console.log('='.repeat(80));

    // Verification
    console.log('\n🔍 Verifying import...\n');
    
    const productCount = (await pool.query('SELECT COUNT(*) FROM products')).rows[0].count;
    const imageCount = (await pool.query('SELECT COUNT(*) FROM product_images')).rows[0].count;
    const cloudinaryCount = (await pool.query("SELECT COUNT(*) FROM product_images WHERE image_url LIKE '%cloudinary%'")).rows[0].count;
    
    console.log(`📊 Total products in database: ${productCount}`);
    console.log(`📊 Total images in database: ${imageCount}`);
    console.log(`📊 Images with Cloudinary URLs: ${cloudinaryCount}`);

    if (parseInt(productCount) >= 100 && parseInt(cloudinaryCount) >= 100) {
      console.log('\n✅ Import successful - production-ready catalog created');
    } else {
      console.log('\n⚠️  Import completed but may need review');
    }

    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('\n🧹 Cleaned up temporary files');
    }

  } catch (error) {
    console.error('❌ Import error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

importRealProducts();
