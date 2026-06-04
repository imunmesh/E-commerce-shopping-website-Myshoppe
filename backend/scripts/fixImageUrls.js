const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Category-specific Unsplash keywords
const categoryKeywords = {
  "Men's Clothing": ['mens fashion', 'mens shirt', 'mens jeans', 'mens jacket', 'mens tshirt'],
  "Women's Clothing": ['womens fashion', 'womens dress', 'womens top', 'womens skirt', 'womens blouse'],
  "Shoes": ['sneakers', 'running shoes', 'formal shoes', 'boots', 'sandals'],
  "Watches": ['wrist watch', 'analog watch', 'smart watch', 'luxury watch', 'casio watch'],
  "Bags": ['backpack', 'handbag', 'laptop bag', 'travel bag', 'shoulder bag'],
  "Electronics": ['electronics', 'gadgets', 'tech devices', 'smart home', 'computer'],
  "Smartphones": ['smartphone', 'mobile phone', 'iphone', 'android phone', 'cell phone'],
  "Laptops": ['laptop', 'notebook', 'macbook', 'ultrabook', 'computer'],
  "Headphones": ['headphones', 'earphones', 'earbuds', 'wireless headphones', 'audio'],
  "Gaming": ['gaming console', 'gaming setup', 'video games', 'gaming controller', 'playstation'],
  "Beauty & Cosmetics": ['makeup', 'cosmetics', 'lipstick', 'skincare', 'beauty products'],
  "Home & Kitchen": ['kitchen', 'home appliances', 'cooking', 'kitchenware', 'blender'],
  "Furniture": ['furniture', 'sofa', 'chair', 'table', 'bed'],
  "Sports & Fitness": ['fitness', 'gym', 'workout', 'sports equipment', 'exercise'],
  "Books": ['books', 'reading', 'library', 'novel', 'bookshelf'],
  "Toys & Kids": ['toys', 'kids toys', 'children toys', 'educational toys', 'lego']
};

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateUnsplashUrl = (category, index) => {
  const keywords = categoryKeywords[category] || ['product', 'item'];
  const keyword = getRandomItem(keywords);
  const encodedKeyword = encodeURIComponent(keyword);
  const randomId = getRandomNumber(1, 1000);
  return `https://source.unsplash.com/800x800/?${encodedKeyword}&sig=${randomId}`;
};

async function fixImageUrls() {
  try {
    console.log('🔧 Fixing image URLs...\n');

    // Get all products
    const productsResult = await pool.query('SELECT id, category, thumbnail FROM products');
    const products = productsResult.rows;
    console.log(`📦 Found ${products.length} products`);

    let updatedCount = 0;

    for (const product of products) {
      // Generate new Unsplash URL for thumbnail
      const newThumbnail = generateUnsplashUrl(product.category, product.id);
      
      await pool.query(
        'UPDATE products SET thumbnail = $1 WHERE id = $2',
        [newThumbnail, product.id]
      );

      // Get all images for this product
      const imagesResult = await pool.query(
        'SELECT id FROM product_images WHERE product_id = $1',
        [product.id]
      );

      // Update each image URL
      for (const image of imagesResult.rows) {
        const newImageUrl = generateUnsplashUrl(product.category, product.id + image.id);
        await pool.query(
          'UPDATE product_images SET image_url = $1 WHERE id = $2',
          [newImageUrl, image.id]
        );
      }

      updatedCount++;
      if (updatedCount % 100 === 0) {
        console.log(`📊 Updated ${updatedCount}/${products.length} products...`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} products with real Unsplash URLs`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixImageUrls();
