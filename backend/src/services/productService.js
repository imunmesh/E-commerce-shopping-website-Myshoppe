const db = require('../db');

/**
 * Search products with multiple filters
 */
const searchProducts = async ({ query, category, brand, minPrice, maxPrice }) => {
  const runQuery = async (matchAll = true) => {
    let queryText = `
      SELECT p.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', pi.id,
                   'image_url', pi.image_url,
                   'is_primary', pi.is_primary
                 )
               ) FILTER (WHERE pi.image_url IS NOT NULL),
               '[]'
             ) as images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
    `;

    const whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (query) {
      const words = query.split(/\s+/).filter(Boolean);
      const clauses = [];
      words.forEach(word => {
        clauses.push(`(p.title ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx} OR p.category ILIKE $${paramIdx} OR p.brand ILIKE $${paramIdx})`);
        params.push(`%${word}%`);
        paramIdx++;
      });
      if (clauses.length > 0) {
        whereClauses.push(`(${clauses.join(matchAll ? ' AND ' : ' OR ')})`);
      }
    }

    if (category) {
      whereClauses.push(`p.category = $${paramIdx}`);
      params.push(category);
      paramIdx++;
    }

    if (brand) {
      whereClauses.push(`p.brand = $${paramIdx}`);
      params.push(brand);
      paramIdx++;
    }

    if (minPrice) {
      whereClauses.push(`p.price >= $${paramIdx}`);
      params.push(parseFloat(minPrice));
      paramIdx++;
    }

    if (maxPrice) {
      whereClauses.push(`p.price <= $${paramIdx}`);
      params.push(parseFloat(maxPrice));
      paramIdx++;
    }

    if (whereClauses.length > 0) {
      queryText += ` WHERE ` + whereClauses.join(' AND ');
    }

    queryText += ` GROUP BY p.id ORDER BY p.rating DESC, p.created_at DESC LIMIT 6`;

    const result = await db.query(queryText, params);
    return result.rows;
  };

  try {
    let rows = await runQuery(true);
    if (rows.length === 0 && query && query.split(/\s+/).filter(Boolean).length > 1) {
      console.log(`searchProducts: AND query returned 0 rows. Retrying with OR fallback.`);
      rows = await runQuery(false);
    }
    return rows;
  } catch (error) {
    console.error('Error searching products in chatbot service:', error);
    throw new Error('Failed to search products.');
  }
};

/**
 * Smart product recommendations matching category, use case/purpose, and price budget
 */
const recommendProducts = async ({ category, useCase, maxPrice, userId }) => {
  let preferredBrands = [];
  if (userId) {
    try {
      const purchasedRes = await db.query(
        `SELECT DISTINCT p.brand 
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         JOIN orders o ON oi.order_id = o.id
         WHERE o.user_id = $1 AND p.brand IS NOT NULL AND p.brand != ''`,
        [userId]
      );
      const wishlistRes = await db.query(
        `SELECT DISTINCT p.brand 
         FROM wishlist w
         JOIN products p ON w.product_id = p.id
         WHERE w.user_id = $1 AND p.brand IS NOT NULL AND p.brand != ''`,
        [userId]
      );
      
      const brandsSet = new Set();
      purchasedRes.rows.forEach(r => brandsSet.add(r.brand));
      wishlistRes.rows.forEach(r => brandsSet.add(r.brand));
      preferredBrands = Array.from(brandsSet);
    } catch (e) {
      console.error('Error fetching preferred brands for recommendations:', e);
    }
  }

  const runQuery = async (matchAll = true) => {
    let queryText = `
      SELECT p.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', pi.id,
                   'image_url', pi.image_url,
                   'is_primary', pi.is_primary
                 )
               ) FILTER (WHERE pi.image_url IS NOT NULL),
               '[]'
             ) as images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
    `;

    const whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (category) {
      whereClauses.push(`p.category ILIKE $${paramIdx}`);
      params.push(`%${category}%`);
      paramIdx++;
    }

    if (useCase) {
      const words = useCase.split(/\s+/).filter(Boolean);
      const clauses = [];
      words.forEach(word => {
        clauses.push(`(p.title ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx} OR p.category ILIKE $${paramIdx} OR p.brand ILIKE $${paramIdx})`);
        params.push(`%${word}%`);
        paramIdx++;
      });
      if (clauses.length > 0) {
        whereClauses.push(`(${clauses.join(matchAll ? ' AND ' : ' OR ')})`);
      }
    }

    if (maxPrice) {
      whereClauses.push(`p.price <= $${paramIdx}`);
      params.push(parseFloat(maxPrice));
      paramIdx++;
    }

    if (whereClauses.length > 0) {
      queryText += ` WHERE ` + whereClauses.join(' AND ');
    }

    let orderByText = `p.rating DESC, p.created_at DESC`;
    if (preferredBrands.length > 0) {
      orderByText = `(CASE WHEN p.brand = ANY($${paramIdx}) THEN 1 ELSE 2 END) ASC, ` + orderByText;
      params.push(preferredBrands);
      paramIdx++;
    }

    queryText += ` GROUP BY p.id ORDER BY ${orderByText} LIMIT 6`;

    const result = await db.query(queryText, params);
    return result.rows;
  };

  try {
    let rows = await runQuery(true);
    if (rows.length === 0 && useCase && useCase.split(/\s+/).filter(Boolean).length > 1) {
      console.log(`recommendProducts: strict AND match returned 0 results. Retrying with OR fallback.`);
      rows = await runQuery(false);
    }
    return rows;
  } catch (error) {
    console.error('Error recommending products in product service:', error);
    throw new Error('Failed to recommend products.');
  }
};

/**
 * Fetch details of a single product
 */
const getProductDetails = async (productId) => {
  try {
    const productResult = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      return null;
    }

    const product = productResult.rows[0];

    const imagesResult = await db.query(
      'SELECT id, image_url, is_primary FROM product_images WHERE product_id = $1',
      [productId]
    );
    product.images = imagesResult.rows;

    return product;
  } catch (error) {
    console.error('Error fetching product details in chatbot service:', error);
    throw new Error('Failed to load product details.');
  }
};

/**
 * Compare multiple products side-by-side
 */
const compareProducts = async (productIds) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }

  // Cap comparisons at 4 items
  const cleanIds = productIds.slice(0, 4).map(id => parseInt(id));

  try {
    const result = await db.query(
      `SELECT p.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', pi.id,
                    'image_url', pi.image_url,
                    'is_primary', pi.is_primary
                  )
                ) FILTER (WHERE pi.image_url IS NOT NULL),
                '[]'
              ) as images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE p.id = ANY($1)
       GROUP BY p.id`,
      [cleanIds]
    );
    return result.rows;
  } catch (error) {
    console.error('Error comparing products in chatbot service:', error);
    throw new Error('Failed to compare products.');
  }
};

/**
 * Add a product to the authenticated user's shopping cart
 */
const addToCart = async (productId, userId, quantity = 1) => {
  if (!userId) return { error: 'Authentication required to add items to your cart.' };
  
  try {
    // Check stock
    const productRes = await db.query('SELECT stock, title FROM products WHERE id = $1', [productId]);
    if (productRes.rows.length === 0) {
      return { error: 'Product not found.' };
    }

    const { stock, title } = productRes.rows[0];
    if (stock < quantity) {
      return { error: `Insufficient inventory. Only ${stock} items left in stock.` };
    }

    // Get or create cart ID
    let cartResult = await db.query('SELECT id FROM cart WHERE user_id = $1', [userId]);
    let cartId;
    if (cartResult.rows.length === 0) {
      const newCart = await db.query('INSERT INTO cart (user_id) VALUES ($1) RETURNING id', [userId]);
      cartId = newCart.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
    }

    // Check checkItem
    const checkItem = await db.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cartId, productId]
    );

    if (checkItem.rows.length > 0) {
      const newQuantity = checkItem.rows[0].quantity + parseInt(quantity);
      if (newQuantity > stock) {
        return { error: `Cannot add more. Limit of ${stock} in stock reached.` };
      }
      await db.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2',
        [newQuantity, checkItem.rows[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
        [cartId, productId, parseInt(quantity)]
      );
    }

    return { success: true, message: `"${title}" has been successfully added to your cart.` };
  } catch (error) {
    console.error('Error in addToCart database tool:', error);
    return { error: 'Failed to add item to cart.' };
  }
};

/**
 * Add a product to the authenticated user's wishlist
 */
const addToWishlist = async (productId, userId) => {
  if (!userId) return { error: 'Authentication required to save items to your wishlist.' };
  
  try {
    // Verify product exists
    const prodRes = await db.query('SELECT title FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      return { error: 'Product not found.' };
    }

    const { title } = prodRes.rows[0];

    // Insert ignoring duplicates via ON CONFLICT
    await db.query(
      `INSERT INTO wishlist (user_id, product_id) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [userId, productId]
    );

    return { success: true, message: `"${title}" has been saved to your wishlist.` };
  } catch (error) {
    console.error('Error in addToWishlist database tool:', error);
    return { error: 'Failed to add item to wishlist.' };
  }
};

/**
 * Fetch customer reviews for a specific product ID
 */
const getProductReviews = async (productId) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name as user_name, r.image_url
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [productId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching reviews in product service:', error);
    throw new Error('Failed to fetch product reviews.');
  }
};

/**
 * Fetch available/active discount coupons
 */
const getAvailableCoupons = async () => {
  try {
    const result = await db.query(
      `SELECT code, description, discount_type, discount_value, minimum_order_amount, expiry_date 
       FROM coupons 
       WHERE is_active = TRUE 
         AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)
         AND (usage_limit IS NULL OR used_count < usage_limit)
       ORDER BY discount_value DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching coupons in chatbot service:', error);
    return [];
  }
};

/**
 * Remove a product from the user's shopping cart
 */
const removeFromCart = async (productId, userId) => {
  if (!userId) return { error: 'Authentication required to remove items from your cart.' };
  try {
    const cartRes = await db.query('SELECT id FROM cart WHERE user_id = $1', [userId]);
    if (cartRes.rows.length === 0) return { success: true, message: 'Cart is already empty.' };
    const cartId = cartRes.rows[0].id;
    
    const deleteRes = await db.query(
      'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2 RETURNING id',
      [cartId, productId]
    );
    if (deleteRes.rows.length === 0) {
      return { error: 'Product was not found in your cart.' };
    }
    return { success: true, message: 'Item successfully removed from your cart.' };
  } catch (error) {
    console.error('Error in removeFromCart:', error);
    return { error: 'Failed to remove item from cart.' };
  }
};

/**
 * Retrieve user's current cart details, items, quantities, and subtotal
 */
const viewCart = async (userId) => {
  if (!userId) return { error: 'Authentication required to view your cart.' };
  try {
    const cartRes = await db.query('SELECT id FROM cart WHERE user_id = $1', [userId]);
    if (cartRes.rows.length === 0) return { items: [], subtotal: 0 };
    const cartId = cartRes.rows[0].id;

    const itemsRes = await db.query(
      `SELECT ci.quantity, p.id as product_id, p.title, p.price, p.discount, p.stock, p.brand
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    let subtotal = 0;
    const items = itemsRes.rows.map(item => {
      const originalPrice = parseFloat(item.price);
      const discountPct = parseFloat(item.discount || 0);
      const finalPrice = originalPrice * (1 - discountPct / 100);
      const itemSubtotal = finalPrice * item.quantity;
      subtotal += itemSubtotal;

      return {
        productId: item.product_id,
        title: item.title,
        brand: item.brand,
        quantity: item.quantity,
        originalPrice,
        discount: discountPct,
        finalPrice,
        subtotal: itemSubtotal
      };
    });

    return { items, subtotal };
  } catch (error) {
    console.error('Error in viewCart:', error);
    return { error: 'Failed to retrieve cart details.' };
  }
};

/**
 * Get detailed subtotal, tax, and estimated checkout bill for the cart
 */
const checkoutSummary = async (userId) => {
  if (!userId) return { error: 'Authentication required to view checkout summary.' };
  try {
    const cartData = await viewCart(userId);
    if (cartData.error) return cartData;
    if (cartData.items.length === 0) return { error: 'Your cart is empty. Add items to cart before checkout.' };

    const tax = cartData.subtotal * 0.08;
    const total = cartData.subtotal + tax;

    const coupons = await getAvailableCoupons();

    return {
      subtotal: cartData.subtotal,
      tax,
      shipping: 'FREE',
      total,
      itemCount: cartData.items.reduce((sum, item) => sum + item.quantity, 0),
      recommendedCoupons: coupons.slice(0, 2).map(c => ({
        code: c.code,
        description: c.description
      }))
    };
  } catch (error) {
    console.error('Error in checkoutSummary:', error);
    return { error: 'Failed to calculate checkout summary.' };
  }
};

/**
 * Check product inventory level and warehouse dispatch location
 */
const checkInventory = async (productId) => {
  try {
    const res = await db.query('SELECT title, stock, category FROM products WHERE id = $1', [productId]);
    if (res.rows.length === 0) return { error: 'Product not found.' };
    const { title, stock, category } = res.rows[0];

    let warehouse = 'Mumbai Central Warehouse';
    if (category?.toLowerCase().includes('phone') || category?.toLowerCase().includes('electronic')) {
      warehouse = 'Mumbai Electronics Dispatch Center';
    } else if (category?.toLowerCase().includes('shoe') || category?.toLowerCase().includes('cloth')) {
      warehouse = 'Delhi Apparel Fulfillment Hub';
    }

    return {
      productId,
      title,
      stock,
      warehouse,
      status: stock > 5 ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock'
    };
  } catch (error) {
    console.error('Error in checkInventory:', error);
    return { error: 'Failed to check inventory.' };
  }
};

/**
 * Fetch personalized user preferences (brands, budgets) from database memory
 */
const getUserPreferences = async (userId) => {
  if (!userId) return null;
  try {
    const res = await db.query('SELECT preferences FROM user_preferences WHERE user_id = $1', [userId]);
    return res.rows.length > 0 ? res.rows[0].preferences : {};
  } catch (error) {
    console.error('Error in getUserPreferences:', error);
    return {};
  }
};

/**
 * Save newly learned preferences back to database memory
 */
const saveUserPreferences = async (userId, preferences) => {
  if (!userId) return { error: 'Authentication required.' };
  try {
    const currentPreferences = await getUserPreferences(userId) || {};
    const merged = { ...currentPreferences, ...preferences };

    await db.query(
      `INSERT INTO user_preferences (user_id, preferences, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(merged)]
    );
    return { success: true, preferences: merged };
  } catch (error) {
    console.error('Error in saveUserPreferences:', error);
    return { error: 'Failed to save preferences.' };
  }
};

module.exports = {
  searchProducts,
  recommendProducts,
  getProductDetails,
  compareProducts,
  addToCart,
  addToWishlist,
  getProductReviews,
  getAvailableCoupons,
  removeFromCart,
  viewCart,
  checkoutSummary,
  checkInventory,
  getUserPreferences,
  saveUserPreferences
};
