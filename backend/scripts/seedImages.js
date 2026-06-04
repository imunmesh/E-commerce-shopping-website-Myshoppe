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

// Category-specific image collections with Unsplash keywords
const CATEGORY_IMAGES = {
  "Men's Clothing": {
    keywords: ['mens fashion', 'mens clothing', 'mens shirt', 'mens jeans', 'mens jacket'],
    count: 100
  },
  "Women's Clothing": {
    keywords: ['womens fashion', 'womens clothing', 'womens dress', 'womens top', 'womens skirt'],
    count: 100
  },
  "Shoes": {
    keywords: ['sneakers', 'running shoes', 'formal shoes', 'boots', 'sandals'],
    count: 100
  },
  "Electronics": {
    keywords: ['electronics', 'gadgets', 'tech', 'devices', 'smart home'],
    count: 100
  },
  "Smartphones": {
    keywords: ['smartphone', 'mobile phone', 'iphone', 'android phone', 'cell phone'],
    count: 50
  },
  "Laptops": {
    keywords: ['laptop', 'notebook', 'computer', 'macbook', 'ultrabook'],
    count: 50
  },
  "Watches": {
    keywords: ['watch', 'wrist watch', 'smart watch', 'analog watch', 'luxury watch'],
    count: 50
  },
  "Bags": {
    keywords: ['backpack', 'handbag', 'laptop bag', 'travel bag', 'shoulder bag'],
    count: 50
  },
  "Furniture": {
    keywords: ['furniture', 'sofa', 'chair', 'table', 'bed'],
    count: 50
  },
  "Sports & Fitness": {
    keywords: ['fitness', 'sports equipment', 'gym', 'exercise', 'workout'],
    count: 50
  },
  "Beauty & Cosmetics": {
    keywords: ['makeup', 'cosmetics', 'beauty products', 'skincare', 'lipstick'],
    count: 50
  },
  "Home & Kitchen": {
    keywords: ['kitchen', 'home appliances', 'cooking', 'kitchenware', 'appliances'],
    count: 50
  },
  "Books": {
    keywords: ['books', 'reading', 'library', 'bookshelf', 'novel'],
    count: 30
  },
  "Toys & Kids": {
    keywords: ['toys', 'kids toys', 'children toys', 'educational toys', 'play'],
    count: 30
  }
};

// Generate Cloudinary URL with optimizations
const generateCloudinaryUrl = (keyword, index, width = 800, height = 800) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const transformation = `f_auto,q_auto,w_${width},h_${height},c_fill`;
  const publicId = `myshopee/${keyword.replace(/\s+/g, '-')}-${index}`;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}.jpg`;
};

// Generate unique image URLs for a category
const generateCategoryImages = (category, count) => {
  const config = CATEGORY_IMAGES[category];
  const images = [];
  const usedUrls = new Set();

  for (let i = 0; i < count; i++) {
    const keyword = config.keywords[i % config.keywords.length];
    const uniqueIndex = i + Math.floor(i / config.keywords.length) * 1000;
    const url = generateCloudinaryUrl(keyword, uniqueIndex);
    
    if (!usedUrls.has(url)) {
      usedUrls.add(url);
      images.push({
        url,
        keyword,
        index: uniqueIndex
      });
    }
  }

  return images;
};

// Main function to seed images
async function seedImages() {
  try {
    console.log('🖼️  Starting image seeding...');

    // Clear existing product images
    console.log('🗑️  Clearing existing product images...');
    await pool.query('DELETE FROM product_images');
    console.log('✅ Cleared existing product images');

    // Get all products
    console.log('📦 Fetching all products...');
    const productsResult = await pool.query('SELECT id, category FROM products ORDER BY id');
    const products = productsResult.rows;
    console.log(`✅ Found ${products.length} products`);

    // Generate image collections for each category
    const categoryImagePools = {};
    for (const category of Object.keys(CATEGORY_IMAGES)) {
      const images = generateCategoryImages(category, CATEGORY_IMAGES[category].count);
      categoryImagePools[category] = images;
      console.log(`✅ Generated ${images.length} images for ${category}`);
    }

    // Assign images to products
    let imageIndex = 0;
    for (const product of products) {
      const category = product.category;
      const imagePool = categoryImagePools[category] || categoryImagePools['Electronics'];
      
      if (imagePool && imagePool.length >= 4) {
        // Get 4-5 unique images for this product
        const numImages = Math.floor(Math.random() * 2) + 4; // 4-5 images
        const productImages = [];
        const usedIndices = new Set();

        for (let i = 0; i < numImages; i++) {
          let randomIndex;
          do {
            randomIndex = Math.floor(Math.random() * imagePool.length);
          } while (usedIndices.has(randomIndex) && usedIndices.size < imagePool.length);
          
          usedIndices.add(randomIndex);
          productImages.push({
            ...imagePool[randomIndex],
            is_primary: i === 0 // First image is primary
          });
        }

        // Insert images into database
        for (const img of productImages) {
          await pool.query(
            `INSERT INTO product_images (product_id, image_url, public_id, is_primary)
             VALUES ($1, $2, $3, $4)`,
            [
              product.id,
              img.url,
              `myshopee-product-${product.id}-${img.index}`,
              img.is_primary
            ]
          );
        }

        // Update product thumbnail with primary image
        const primaryImage = productImages[0];
        await pool.query(
          'UPDATE products SET thumbnail = $1 WHERE id = $2',
          [primaryImage.url, product.id]
        );

        imageIndex++;
        
        if (imageIndex % 100 === 0) {
          console.log(`📊 Processed ${imageIndex}/${products.length} products...`);
        }
      }
    }

    console.log('🎉 Image seeding completed successfully!');
    console.log(`📊 Total products processed: ${products.length}`);
    console.log(`📊 Total images inserted: ${imageIndex * 4}`); // Approximate

  } catch (error) {
    console.error('❌ Error seeding images:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedImages().catch(console.error);
