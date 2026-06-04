const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Category configuration with counts
const CATEGORIES = {
  "Men's Clothing": 150,
  "Women's Clothing": 150,
  "Shoes": 120,
  "Watches": 80,
  "Bags": 80,
  "Electronics": 150,
  "Smartphones": 80,
  "Laptops": 60,
  "Headphones": 60,
  "Gaming": 50,
  "Beauty & Cosmetics": 80,
  "Home & Kitchen": 100,
  "Furniture": 60,
  "Sports & Fitness": 80,
  "Books": 60,
  "Toys & Kids": 60
};

// Brands by category
const BRANDS = {
  "Men's Clothing": ["Nike", "Adidas", "Puma", "Reebok", "Under Armour", "Levi's", "H&M", "Zara", "Gap", "Tommy Hilfiger"],
  "Women's Clothing": ["Zara", "H&M", "Mango", "Forever 21", "Nike", "Adidas", "Levi's", "Gap", "Tommy Hilfiger", "Calvin Klein"],
  "Shoes": ["Nike", "Adidas", "Puma", "Reebok", "Skechers", "New Balance", "ASICS", "Converse", "Vans", "Jordan"],
  "Watches": ["Fossil", "Casio", "Titan", "Seiko", "Timex", "Citizen", "Michael Kors", "Armani", "Tommy Hilfiger", "Daniel Wellington"],
  "Bags": ["Wildcraft", "American Tourister", "Skybags", "Nike", "Adidas", "Puma", "Samsonite", "VIP", "Lavie", "Hidesign"],
  "Electronics": ["Apple", "Samsung", "Sony", "LG", "Panasonic", "Philips", "Bose", "JBL", "Dell", "HP"],
  "Smartphones": ["Apple", "Samsung", "OnePlus", "Xiaomi", "Realme", "Vivo", "Oppo", "Google", "Motorola", "Nokia"],
  "Laptops": ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "MSI", "Razer", "Microsoft", "LG"],
  "Headphones": ["Sony", "Bose", "JBL", "Sennheiser", "Audio-Technica", "Beats", "Skullcandy", "Plantronics", "Razer", "HyperX"],
  "Gaming": ["Sony", "Microsoft", "Nintendo", "Razer", "Logitech", "SteelSeries", "ASUS", "MSI", "Corsair", "HyperX"],
  "Beauty & Cosmetics": ["L'Oreal", "Maybelline", "MAC", "Revlon", "Lakme", "Colorbar", "Nykaa", "Forest Essentials", "The Body Shop", "Biotique"],
  "Home & Kitchen": ["Philips", "Prestige", "Hawkins", "Pigeon", "Tefal", "Morphy Richards", "Bajaj", "Usha", "Panasonic", "LG"],
  "Furniture": ["Urban Ladder", "Pepperfry", "IKEA", "Godrej", "Nilkamal", "Durian", "Featherlite", "Wipro", "HomeTown", "StyleSpa"],
  "Sports & Fitness": ["Nike", "Adidas", "Puma", "Reebok", "Decathlon", "Under Armour", "ASICS", "New Balance", "Skullcandy", "JBL"],
  "Books": ["Penguin", "Random House", "HarperCollins", "Simon & Schuster", "Macmillan", "Oxford", "Cambridge", "Pearson", "McGraw Hill", "Wiley"],
  "Toys & Kids": ["LEGO", "Mattel", "Hasbro", "Fisher-Price", "Hot Wheels", "Barbie", "Play-Doh", "Nerf", "Crayola", "Funskool"]
};

// Product name templates by category
const PRODUCT_TEMPLATES = {
  "Men's Clothing": ["{brand} {type} for Men", "{brand} {color} {type}", "{brand} Premium {type}", "{brand} {type} - {color}"],
  "Women's Clothing": ["{brand} {type} for Women", "{brand} {color} {type}", "{brand} Elegant {type}", "{brand} {type} - {color}"],
  "Shoes": ["{brand} {type} - {color}", "{brand} {type} for {gender}", "{brand} {type} - {color}", "{brand} {type} {gender}"],
  "Watches": ["{brand} {type} Watch", "{brand} {type} - {color}", "{brand} {type} Watch - {color}", "{brand} {type} Series"],
  "Bags": ["{brand} {type} - {color}", "{brand} {type} Bag", "{brand} {type} - {color}", "{brand} {type} {size}"],
  "Electronics": ["{brand} {type}", "{brand} {type} - {color}", "{brand} {type} Series", "{brand} {type} {feature}"],
  "Smartphones": ["{brand} {type} {storage}", "{brand} {type} - {color}", "{brand} {type} {storage}GB", "{brand} {type} {feature}"],
  "Laptops": ["{brand} {type} {processor}", "{brand} {type} {ram}GB RAM", "{brand} {type} {storage}", "{brand} {type} - {feature}"],
  "Headphones": ["{brand} {type} - {color}", "{brand} {type} Headphones", "{brand} {type} Wireless", "{brand} {type} - {feature}"],
  "Gaming": ["{brand} {type}", "{brand} {type} - {color}", "{brand} {type} Controller", "{brand} {type} {feature}"],
  "Beauty & Cosmetics": ["{brand} {type} - {color}", "{brand} {type} {feature}", "{brand} {type} - {size}", "{brand} {type} Premium"],
  "Home & Kitchen": ["{brand} {type}", "{brand} {type} - {color}", "{brand} {type} {size}", "{brand} {type} {feature}"],
  "Furniture": ["{brand} {type} - {color}", "{brand} {type} {size}", "{brand} {type} {material}", "{brand} {type} {feature}"],
  "Sports & Fitness": ["{brand} {type}", "{brand} {type} - {color}", "{brand} {type} {size}", "{brand} {type} {feature}"],
  "Books": ["{title} by {author}", "{title} - {genre}", "{title} (Paperback)", "{title} (Hardcover)"],
  "Toys & Kids": ["{brand} {type} - {color}", "{brand} {type} {age}", "{brand} {type} {feature}", "{brand} {type} Set"]
};

// Product types by category
const PRODUCT_TYPES = {
  "Men's Clothing": ["T-Shirt", "Shirt", "Jeans", "Pants", "Jacket", "Hoodie", "Sweater", "Shorts", "Blazer", "Tracksuit"],
  "Women's Clothing": ["Dress", "Top", "Jeans", "Skirt", "Blouse", "Jacket", "Hoodie", "Sweater", "Leggings", "Kurta"],
  "Shoes": ["Running Shoes", "Sneakers", "Sports Shoes", "Formal Shoes", "Casual Shoes", "Boots", "Sandals", "Loafers", "Slippers", "Training Shoes"],
  "Watches": ["Analog Watch", "Digital Watch", "Smart Watch", "Chronograph", "Sports Watch", "Dress Watch", "Automatic Watch", "Quartz Watch", "Fitness Watch", "Luxury Watch"],
  "Bags": ["Backpack", "Laptop Bag", "Travel Bag", "Handbag", "Shoulder Bag", "Tote Bag", "Duffel Bag", "Messenger Bag", "Sling Bag", "Wallet"],
  "Electronics": ["TV", "Speaker", "Camera", "Monitor", "Printer", "Scanner", "Projector", "Home Theater", "Soundbar", "DVD Player"],
  "Smartphones": ["Smartphone", "Phone", "Mobile", "iPhone", "Android Phone", "5G Phone", "Foldable Phone", "Budget Phone", "Flagship Phone", "Compact Phone"],
  "Laptops": ["Laptop", "Notebook", "Ultrabook", "Gaming Laptop", "Business Laptop", "2-in-1 Laptop", "Chromebook", "Workstation", "Thin Laptop", "Power Laptop"],
  "Headphones": ["Headphones", "Earphones", "Earbuds", "Wireless Headphones", "Noise Cancelling Headphones", "Sports Earphones", "Studio Headphones", "Bluetooth Headphones", "Over-Ear Headphones", "In-Ear Headphones"],
  "Gaming": ["Gaming Console", "Gaming Controller", "Gaming Mouse", "Gaming Keyboard", "Gaming Headset", "Gaming Chair", "Gaming Monitor", "Gaming Laptop", "VR Headset", "Gaming Desk"],
  "Beauty & Cosmetics": ["Lipstick", "Foundation", "Mascara", "Eyeliner", "Compact", "Blush", "Highlighter", "Concealer", "Primer", "Setting Spray"],
  "Home & Kitchen": ["Mixer Grinder", "Blender", "Toaster", "Kettle", "Iron", "Vacuum Cleaner", "Air Fryer", "Microwave", "Refrigerator", "Washing Machine"],
  "Furniture": ["Sofa", "Bed", "Table", "Chair", "Wardrobe", "Bookshelf", "Dining Table", "Coffee Table", "Desk", "Cabinet"],
  "Sports & Fitness": ["Dumbbells", "Treadmill", "Yoga Mat", "Resistance Bands", "Exercise Bike", "Gym Ball", "Jump Rope", "Kettlebell", "Punching Bag", "Fitness Tracker"],
  "Books": ["Fiction", "Non-Fiction", "Mystery", "Romance", "Thriller", "Science Fiction", "Self-Help", "Biography", "History", "Fantasy"],
  "Toys & Kids": ["Building Blocks", "Action Figures", "Dolls", "Board Games", "Puzzle", "Remote Control Car", "Soft Toys", "Educational Toys", "Art & Craft", "Outdoor Toys"]
};

// Colors
const COLORS = ["Black", "White", "Red", "Blue", "Green", "Yellow", "Pink", "Purple", "Orange", "Brown", "Gray", "Navy", "Maroon", "Teal", "Gold", "Silver"];

// Sizes
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "30", "32", "34", "36", "38", "40", "42", "44"];

// Storage options
const STORAGE = ["64GB", "128GB", "256GB", "512GB", "1TB", "2TB"];

// RAM options
const RAM = ["4GB", "8GB", "16GB", "32GB", "64GB"];

// Materials
const MATERIALS = ["Wood", "Metal", "Plastic", "Leather", "Fabric", "Glass", "Ceramic", "Rubber", "Foam", "Mesh"];

// Features
const FEATURES = ["Pro", "Plus", "Max", "Ultra", "Premium", "Elite", "Advanced", "Smart", "Wireless", "Bluetooth"];

// Genders
const GENDERS = ["Men", "Women", "Unisex", "Kids"];

// Book titles and authors
const BOOK_TITLES = ["The Great Adventure", "Mystery of the Lost City", "Love in Paris", "The Dark Secret", "Journey to Success", "The Final Chapter", "Beyond the Stars", "The Hidden Truth", "Echoes of the Past", "The New Beginning"];
const BOOK_AUTHORS = ["John Smith", "Emily Johnson", "Michael Brown", "Sarah Davis", "David Wilson", "Jessica Taylor", "Robert Anderson", "Lisa Thomas", "William Jackson", "Amanda White"];
const BOOK_GENRES = ["Fiction", "Non-Fiction", "Mystery", "Romance", "Thriller", "Science Fiction", "Self-Help", "Biography", "History", "Fantasy"];

// Age groups for toys
const AGE_GROUPS = ["3+ Years", "5+ Years", "8+ Years", "10+ Years", "12+ Years", "14+ Years", "16+ Years", "18+ Years"];

// Helper functions
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

// Generate SKU
const generateSKU = (category, id) => {
  const prefix = category.substring(0, 3).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}-${id}`;
};

// Generate product name
const generateProductName = (category, brand, type) => {
  const templates = PRODUCT_TEMPLATES[category];
  const template = getRandomItem(templates);
  
  let name = template
    .replace('{brand}', brand)
    .replace('{type}', type)
    .replace('{color}', getRandomItem(COLORS))
    .replace('{size}', getRandomItem(SIZES))
    .replace('{storage}', getRandomItem(STORAGE))
    .replace('{ram}', getRandomItem(RAM))
    .replace('{material}', getRandomItem(MATERIALS))
    .replace('{feature}', getRandomItem(FEATURES))
    .replace('{gender}', getRandomItem(GENDERS))
    .replace('{title}', getRandomItem(BOOK_TITLES))
    .replace('{author}', getRandomItem(BOOK_AUTHORS))
    .replace('{genre}', getRandomItem(BOOK_GENRES))
    .replace('{age}', getRandomItem(AGE_GROUPS))
    .replace('{processor}', `i${getRandomNumber(3, 9)}-${getRandomNumber(1000, 13000)}K`);
  
  return name;
};

// Generate description
const generateDescription = (category, brand, type) => {
  const descriptions = [
    `Experience premium quality with this ${brand} ${type}. Crafted with attention to detail, this product offers exceptional performance and durability.`,
    `Elevate your lifestyle with this ${brand} ${type}. Perfect for everyday use, it combines style with functionality.`,
    `Discover the perfect blend of innovation and design with this ${brand} ${type}. Ideal for modern living.`,
    `This ${brand} ${type} is designed for excellence. Featuring cutting-edge technology and superior build quality.`,
    `Make a statement with this ${brand} ${type}. Stylish, comfortable, and built to last.`
  ];
  return getRandomItem(descriptions);
};

// Generate image URLs using real Unsplash source
const generateImageUrls = (category, type, color) => {
  const images = [];
  const numImages = getRandomNumber(3, 5);

  // Category-specific Unsplash keywords for better image matching
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

  const keywords = categoryKeywords[category] || ['product', 'item'];
  const keyword = getRandomItem(keywords);

  for (let i = 0; i < numImages; i++) {
    // Use Unsplash source API with specific keywords
    const encodedKeyword = encodeURIComponent(keyword);
    const randomId = getRandomNumber(1, 1000);
    images.push(`https://source.unsplash.com/800x800/?${encodedKeyword}&sig=${randomId}`);
  }

  return images;
};

// Generate variants
const generateVariants = (category, productId) => {
  const variants = [];
  
  if (["Men's Clothing", "Women's Clothing", "Shoes"].includes(category)) {
    // Size and color variants
    const selectedColors = COLORS.slice(0, getRandomNumber(3, 5));
    const selectedSizes = SIZES.slice(0, getRandomNumber(4, 6));
    
    selectedColors.forEach(color => {
      selectedSizes.forEach(size => {
        variants.push({
          product_id: productId,
          color,
          size,
          stock: getRandomNumber(5, 50),
          price_adjustment: getRandomFloat(-5, 10)
        });
      });
    });
  } else if (["Smartphones", "Laptops"].includes(category)) {
    // Storage and RAM variants
    const selectedStorage = STORAGE.slice(0, getRandomNumber(2, 4));
    const selectedRAM = RAM.slice(0, getRandomNumber(2, 3));
    
    selectedStorage.forEach(storage => {
      selectedRAM.forEach(ram => {
        variants.push({
          product_id: productId,
          storage,
          ram,
          stock: getRandomNumber(5, 30),
          price_adjustment: getRandomFloat(0, 200)
        });
      });
    });
  } else if (["Headphones", "Watches", "Bags"].includes(category)) {
    // Color variants
    const selectedColors = COLORS.slice(0, getRandomNumber(3, 5));
    
    selectedColors.forEach(color => {
      variants.push({
        product_id: productId,
        color,
        stock: getRandomNumber(10, 50),
        price_adjustment: getRandomFloat(-5, 15)
      });
    });
  } else {
    // Simple stock variant
    variants.push({
      product_id: productId,
      stock: getRandomNumber(10, 100),
      price_adjustment: 0
    });
  }
  
  return variants;
};

// Main seeding function
async function seedProducts() {
  try {
    console.log('🌱 Starting product seeding...');
    
    let productId = 1;
    const allProducts = [];
    const allVariants = [];
    const allImages = [];
    
    for (const [category, count] of Object.entries(CATEGORIES)) {
      console.log(`📦 Generating ${count} products for ${category}...`);
      
      const brands = BRANDS[category];
      const types = PRODUCT_TYPES[category];
      
      for (let i = 0; i < count; i++) {
        const brand = getRandomItem(brands);
        const type = getRandomItem(types);
        const color = getRandomItem(COLORS);
        
        const price = getRandomFloat(10, 500);
        const discount = getRandomFloat(0, 50);
        const rating = getRandomFloat(3.0, 5.0);
        const reviewCount = getRandomNumber(10, 500);
        const stock = getRandomNumber(10, 200);
        const sku = generateSKU(category, productId);
        const thumbnail = `https://source.unsplash.com/800x800/?${encodeURIComponent(`${category} ${type} ${color}`)}`;
        
        const product = {
          title: generateProductName(category, brand, type),
          description: generateDescription(category, brand, type),
          category,
          brand,
          price,
          discount,
          rating,
          review_count: reviewCount,
          stock,
          sku,
          thumbnail,
          is_bestseller: Math.random() > 0.8,
          is_featured: Math.random() > 0.85,
          is_new_arrival: Math.random() > 0.9
        };
        
        allProducts.push(product);
        
        // Generate variants
        const variants = generateVariants(category, productId);
        allVariants.push(...variants);
        
        // Generate images with primary/gallery structure
        const images = generateImageUrls(category, type, color);
        images.forEach((imageUrl, idx) => {
          allImages.push({
            product_id: productId,
            image_url: imageUrl,
            public_id: `product_${productId}_img_${idx}`,
            is_primary: idx === 0 // First image is primary
          });
        });
        
        productId++;
      }
    }
    
    console.log(`✅ Generated ${allProducts.length} products`);
    console.log(`✅ Generated ${allVariants.length} variants`);
    console.log(`✅ Generated ${allImages.length} images`);

    // Insert products
    console.log('💾 Inserting products into database...');
    for (const product of allProducts) {
      await pool.query(
        `INSERT INTO products (title, description, category, brand, price, discount, rating, review_count, stock, sku, thumbnail, is_bestseller, is_featured, is_new_arrival)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          product.title,
          product.description,
          product.category,
          product.brand,
          product.price,
          product.discount,
          product.rating,
          product.review_count,
          product.stock,
          product.sku,
          product.thumbnail,
          product.is_bestseller,
          product.is_featured,
          product.is_new_arrival
        ]
      );
    }

    // Insert variants
    console.log('💾 Inserting variants into database...');
    for (const variant of allVariants) {
      await pool.query(
        `INSERT INTO product_variants (product_id, color, size, storage, ram, stock, price_adjustment)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          variant.product_id,
          variant.color || null,
          variant.size || null,
          variant.storage || null,
          variant.ram || null,
          variant.stock,
          variant.price_adjustment
        ]
      );
    }

    // Insert images with primary/gallery structure
    console.log('💾 Inserting images into database with primary/gallery structure...');
    for (const image of allImages) {
      await pool.query(
        `INSERT INTO product_images (product_id, image_url, public_id, is_primary)
         VALUES ($1, $2, $3, $4)`,
        [image.product_id, image.image_url, image.public_id, image.is_primary || false]
      );
    }
    
    console.log('🎉 Seeding completed successfully!');
    console.log(`📊 Total products: ${allProducts.length}`);
    console.log(`📊 Total variants: ${allVariants.length}`);
    console.log(`📊 Total images: ${allImages.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seed function
seedProducts().catch(console.error);
