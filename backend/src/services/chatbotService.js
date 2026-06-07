const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const geminiService = require('./geminiService');
const productService = require('./productService');
const orderService = require('./orderService');

/**
 * Local helper to search FAQs
 */
const searchFAQs = async (query) => {
  try {
    const result = await db.query(
      `SELECT question, answer 
       FROM faqs 
       WHERE question ILIKE $1 OR answer ILIKE $1 OR category ILIKE $1 
       LIMIT 3`,
      [`%${query}%`]
    );
    return result.rows;
  } catch (error) {
    console.error('Error searching FAQs:', error);
    return [];
  }
};

/**
 * Execute a local tool based on Gemini function call arguments
 */
const executeTool = async (name, args, userId) => {
  console.log(`🛠️ AI Agent executing tool: ${name} with args:`, args);
  switch (name) {
    case 'searchProducts':
      return await productService.searchProducts({
        query: args.query,
        category: args.category,
        brand: args.brand,
        minPrice: args.minPrice,
        maxPrice: args.maxPrice
      });
    case 'recommendProducts':
      return await productService.recommendProducts({
        category: args.category,
        useCase: args.useCase,
        maxPrice: args.maxPrice,
        userId // pass userId dynamically
      });
    case 'getProductDetails':
      return await productService.getProductDetails(args.productId);
    case 'compareProducts':
      return await productService.compareProducts(args.productIds);
    case 'addToCart':
      return await productService.addToCart(args.productId, userId, args.quantity || 1);
    case 'addToWishlist':
      return await productService.addToWishlist(args.productId, userId);
    case 'getProductReviews':
      return await productService.getProductReviews(args.productId);
    case 'getRecentOrders':
      if (!userId) return { error: 'Customer authentication required.' };
      return await orderService.getRecentOrders(userId);
    case 'getOrderStatus':
      if (!userId) return { error: 'Customer authentication required.' };
      return await orderService.getOrderStatus(args.orderId, userId);
    case 'getAvailableCoupons':
      return await productService.getAvailableCoupons();
    case 'searchFAQs':
      return await searchFAQs(args.query);
    case 'getReturnStatus':
      if (!userId) return { error: 'Customer authentication required.' };
      return await orderService.getReturnStatus(args.returnId, userId);
    case 'getLiveTracking':
      return await orderService.getLiveTracking(args.trackingNumber);
    case 'checkReturnEligibility':
      if (!userId) return { error: 'Customer authentication required.' };
      return await orderService.checkReturnEligibility(args.orderItemId, userId);
    case 'createReturnRequest': {
      if (!userId) return { error: 'Customer authentication required.' };
      try {
        const itemRes = await db.query(
          'SELECT order_id FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.id = $1 AND o.user_id = $2',
          [args.orderItemId, userId]
        );
        if (itemRes.rows.length === 0) {
          return { error: `Order item with ID #${args.orderItemId} was not found.` };
        }
        const orderId = itemRes.rows[0].order_id;
        
        // Check duplicate return
        const duplicateRes = await db.query(
          'SELECT id FROM returns WHERE order_id = $1 AND order_item_id = $2',
          [orderId, args.orderItemId]
        );
        if (duplicateRes.rows.length > 0) {
          return { error: 'A return request has already been submitted for this item.' };
        }

        const insertRes = await db.query(
          `INSERT INTO returns (order_id, user_id, reason, description, status, order_item_id) 
           VALUES ($1, $2, $3, $4, 'Pending', $5) RETURNING *`,
          [orderId, userId, args.reason, args.description || '', args.orderItemId]
        );
        
        await db.query(
          `INSERT INTO notifications (user_id, title, message, type) 
           VALUES ($1, $2, $3, $4)`,
          [userId, '📤 Return Requested', `Your return request for item #${args.orderItemId} has been submitted successfully.`, 'Pending']
        );
        return { success: true, message: `Return request submitted successfully for item #${args.orderItemId}.`, returnRequest: insertRes.rows[0] };
      } catch (err) {
        console.error('Error creating return request via tool:', err);
        return { error: 'Failed to create return request.' };
      }
    }
    case 'getRefundStatus':
      if (!userId) return { error: 'Customer authentication required.' };
      return await orderService.getReturnStatus(args.refundId, userId);
    case 'removeFromCart':
      if (!userId) return { error: 'Customer authentication required.' };
      return await productService.removeFromCart(args.productId, userId);
    case 'viewCart':
      if (!userId) return { error: 'Customer authentication required.' };
      return await productService.viewCart(userId);
    case 'checkoutSummary':
      if (!userId) return { error: 'Customer authentication required.' };
      return await productService.checkoutSummary(userId);
    case 'checkInventory':
      return await productService.checkInventory(args.productId);
    case 'updateUserPreferences':
      if (!userId) return { error: 'Customer authentication required.' };
      return await productService.saveUserPreferences(userId, {
        favorite_brands: args.favorite_brands,
        favorite_categories: args.favorite_categories,
        preferred_price_range: args.preferred_price_range
      });
    default:
      throw new Error(`Unknown tool name: ${name}`);
  }
};

/**
 * Simulated Fallback Chatbot when Gemini API Key is missing
 */
const runMockAgent = async (userMessage, userId, contextProductId = null, isQuotaFallback = false) => {
  const query = userMessage.toLowerCase();
  let reply = '';
  let metadata = {};

  // Helper to extract product ID by searching name if no number matches
  const resolveProductId = async (phrase, excludeWords = []) => {
    const matches = query.match(/\b\d+\b/);
    if (matches) return parseInt(matches[0]);

    let cleanName = phrase;
    excludeWords.forEach(word => {
      cleanName = cleanName.replace(new RegExp('\\b' + word + '\\b', 'gi'), '');
    });
    cleanName = cleanName
      .replace(/[\?\.\!\:\,\;\']/g, '')
      .replace(/\bthis\b/gi, '')
      .replace(/\bproduct\b/gi, '')
      .replace(/\bitem\b/gi, '')
      .trim();

    if (cleanName.length > 2) {
      try {
        const matched = await productService.searchProducts({ query: cleanName });
        if (matched && matched.length > 0) {
          return matched[0].id;
        }
      } catch (e) {
        console.error('Failed to search product by name in mock agent:', e);
      }
    }
    return contextProductId || 1;
  };

  if (query.includes('my return') || query.includes('return status') || query.includes('return request')) {
    if (!userId) {
      reply = 'Please sign in to your MyShopee account to check the status of your return request.';
    } else {
      const matches = query.match(/\b\d+\b/);
      if (matches) {
        const returnId = parseInt(matches[0]);
        const returnReq = await orderService.getReturnStatus(returnId, userId);
        if (!returnReq) {
          reply = `I couldn't find any return request with ID #${returnId} associated with your account.`;
        } else {
          let refundStatus = 'Awaiting Approval';
          if (returnReq.status === 'Approved') refundStatus = 'Processing';
          else if (returnReq.status === 'Refunded') refundStatus = 'Refunded';
          else if (returnReq.status === 'Rejected') refundStatus = 'Rejected';
          
          reply = `Here is the status of your return request:\n\n**Return Request ID:** #${returnReq.id}\n**Order ID:** #${returnReq.order_id}\n**Return Reason:** ${returnReq.reason}\n**Status:** ${returnReq.status}\n**Refund:** ${refundStatus}`;
        }
      } else {
        const returnsRes = await db.query(
          `SELECT r.*, o.total_amount FROM returns r 
           JOIN orders o ON r.order_id = o.id 
           WHERE r.user_id = $1 
           ORDER BY r.created_at DESC LIMIT 1`,
          [userId]
        );
        if (returnsRes.rows.length === 0) {
          reply = 'You have not submitted any return requests for your orders yet.';
        } else {
          const returnReq = returnsRes.rows[0];
          let refundStatus = 'Awaiting Approval';
          if (returnReq.status === 'Approved') refundStatus = 'Processing';
          else if (returnReq.status === 'Refunded') refundStatus = 'Refunded';
          else if (returnReq.status === 'Rejected') refundStatus = 'Rejected';

          reply = `Here is your most recent return request:\n\n**Return Request ID:** #${returnReq.id}\n**Order ID:** #${returnReq.order_id}\n**Return Reason:** ${returnReq.reason}\n**Status:** ${returnReq.status}\n**Refund:** ${refundStatus}`;
        }
      }
    }
  } else if (query.includes('eligible') || query.includes('can i return') || query.includes('eligibility')) {
    if (!userId) {
      reply = 'Please sign in to check return eligibility.';
    } else {
      const matches = query.match(/\b\d+\b/);
      const itemId = matches ? parseInt(matches[0]) : 1;
      const res = await orderService.checkReturnEligibility(itemId, userId);
      if (res.error) {
        reply = `Failed to check return eligibility: ${res.error}`;
      } else {
        reply = res.message;
      }
    }
  } else if (query.includes('remove') && (query.includes('cart') || query.includes('product'))) {
    if (!userId) {
      reply = 'Please sign in to your MyShopee account to remove items from your cart.';
    } else {
      const prodId = await resolveProductId(query, ['remove', 'from', 'cart']);
      const res = await productService.removeFromCart(prodId, userId);
      if (res.error) {
        reply = `I couldn't remove that item: ${res.error}`;
      } else {
        reply = `Success! I have removed product #${prodId} from your cart.`;
        metadata.cartUpdated = true;
      }
    }
  } else if (query.includes('view cart') || query.includes('my cart') || query.includes('show cart') || query.includes('what is in my cart') || query.includes('what\'s in my cart')) {
    if (!userId) {
      reply = 'Please sign in to view your shopping cart.';
    } else {
      const res = await productService.viewCart(userId);
      if (res.items.length === 0) {
        reply = 'Your shopping cart is currently empty.';
      } else {
        reply = 'Here are the items in your cart:\n\n' +
          res.items.map(item => `- **${item.title}** (Qty: ${item.quantity}): $${item.finalPrice.toFixed(2)} each (Product ID: **${item.productId}**)`).join('\n') +
          `\n\n**Subtotal:** $${res.subtotal.toFixed(2)}`;
      }
    }
  } else if (query.includes('checkout') || query.includes('summary') || query.includes('bill')) {
    if (!userId) {
      reply = 'Please sign in to view your checkout summary.';
    } else {
      const res = await productService.checkoutSummary(userId);
      if (res.error) {
        reply = `I couldn't calculate your checkout summary: ${res.error}`;
      } else {
        reply = `Here is your checkout invoice breakdown:\n\n- **Subtotal:** $${res.subtotal.toFixed(2)}\n- **Tax (8%):** $${res.tax.toFixed(2)}\n- **Shipping:** ${res.shipping}\n- **Total Bill:** $${res.total.toFixed(2)}\n\n**Recommended Coupons:**\n` +
          res.recommendedCoupons.map(c => `- **${c.code}**: ${c.description}`).join('\n');
      }
    }
  } else if (query.includes('stock') || query.includes('inventory') || query.includes('warehouse')) {
    const prodId = await resolveProductId(query, ['stock', 'inventory', 'warehouse', 'check', 'is', 'in']);
    const res = await productService.checkInventory(prodId);
    if (res.error) {
      reply = `Failed to check stock: ${res.error}`;
    } else {
      reply = `**Product Inventory Check:**\n\n- **Product:** ${res.title}\n- **Stock Units:** ${res.stock}\n- **Warehouse Location:** ${res.warehouse}\n- **Status:** ${res.status}`;
    }
  } else if (query.includes('track') || query.includes('package') || query.includes('courier') || query.includes('where is my')) {
    const trackMatch = query.match(/ms-[a-z]{3}-\d+/i);
    if (trackMatch) {
      const trackingNo = trackMatch[0].toUpperCase();
      const res = await orderService.getLiveTracking(trackingNo);
      if (res.error) {
        reply = res.error;
      } else {
        reply = `**Live Package Tracking:**\n\n- **Courier:** ${res.courier}\n- **Tracking ID:** ${res.trackingNumber}\n- **Status:** ${res.status}\n- **Current Hub Location:** ${res.lastLocation}\n- **Estimated Delivery:** ${res.estimatedDelivery}\n\n**Milestone Tracking Timeline:**\n` +
          res.trackingEvents.map(e => `- [${e.status}] - Hub: ${e.location} - ${e.message}`).join('\n');
      }
    } else {
      if (!userId) {
        reply = 'Please sign in to track your orders.';
      } else {
        const orders = await orderService.getRecentOrders(userId);
        if (orders.length === 0) {
          reply = 'You have not placed any orders yet on MyShopee.';
        } else {
          const firstOrder = orders[0];
          const statusDetails = await orderService.getOrderStatus(firstOrder.id, userId);
          const trackingNo = statusDetails.tracking_number || `MS-DEL-892401`;
          reply = `Here is your most recent order details:\n\n- **Order ID:** #${firstOrder.id}\n- **Order Date:** ${new Date(firstOrder.created_at).toLocaleDateString()}\n- **Order Status:** ${statusDetails.order_status}\n- **Total Amount:** $${parseFloat(firstOrder.total_amount).toFixed(2)}\n- **Estimated Delivery:** ${statusDetails.estimatedDelivery}\n- **Courier Partner:** ${statusDetails.courier_name || 'Delhivery'}\n- **Tracking Number:** \`${trackingNo}\`\n\nTo track this package in real-time, ask me: *"Track package ${trackingNo}"*.`;
        }
      }
    }
  } else if (query.includes('prefer') || query.includes('only buy') || query.includes('my budget is') || query.includes('i love')) {
    if (!userId) {
      reply = 'Please sign in to set your shopping preferences.';
    } else {
      let brands = [];
      let budget = '';
      if (query.includes('adidas')) brands.push('Adidas');
      if (query.includes('nike')) brands.push('Nike');
      if (query.includes('apple')) brands.push('Apple');
      if (query.includes('samsung')) brands.push('Samsung');
      
      const budgetMatch = query.match(/(?:under|below|less\s+than)\s*(?:\$|rs\.?|inr|₹)?\s*(\d+)/i);
      if (budgetMatch) {
        budget = `under $${budgetMatch[1]}`;
      }

      const prefs = {};
      if (brands.length > 0) prefs.favorite_brands = brands;
      if (budget) prefs.preferred_price_range = budget;

      if (Object.keys(prefs).length > 0) {
        const saveRes = await productService.saveUserPreferences(userId, prefs);
        reply = `I've updated your shopping preferences in memory:\n\n- Favorite Brands: ${saveRes.preferences.favorite_brands?.join(', ') || 'None'}\n- Preferred Budget: ${saveRes.preferences.preferred_price_range || 'None'}\n\nI will customize future product recommendations to match these preferences!`;
      } else {
        reply = 'I understood you expressed a preference. What brands or budget limits would you like me to remember?';
      }
    }
  } else if (query.includes('add to cart') || query.includes('add this to cart') || query.includes('buy this')) {
    if (!userId) {
      reply = 'Please sign in to your MyShopee account so that I can add items to your shopping cart.';
    } else {
      const prodId = await resolveProductId(query, ['add', 'to', 'cart', 'buy', 'this']);
      const res = await productService.addToCart(prodId, userId, 1);
      if (res.error) {
        reply = `I couldn't add that item to your cart: ${res.error}`;
      } else {
        reply = `Success! ${res.message} I have updated your cart count in the header automatically.`;
        metadata.cartUpdated = true;
      }
    }
  } else if (query.includes('wishlist') || query.includes('save for later')) {
    if (!userId) {
      reply = 'Please sign in to save items to your wishlist.';
    } else {
      const prodId = await resolveProductId(query, ['wishlist', 'save', 'for', 'later', 'add']);
      const res = await productService.addToWishlist(prodId, userId);
      if (res.error) {
        reply = `I couldn't save that item to your wishlist: ${res.error}`;
      } else {
        reply = `Success! ${res.message} I have added it to your saved list.`;
        metadata.wishlistUpdated = true;
      }
    }
  } else if (query.includes('review') || query.includes('what do customers think') || query.includes('what customer think')) {
    const prodId = await resolveProductId(query, ['review', 'what', 'do', 'customer', 'think', 'about', 's']);
    const reviews = await productService.getProductReviews(prodId);
    if (reviews.length === 0) {
      reply = `Product #${prodId} does not have any customer reviews yet. Be the first to leave a review!`;
    } else {
      reply = `Here are the latest customer reviews for product #${prodId}:\n\n` +
        reviews.map(r => `⭐ **${r.rating}/5** by *${r.user_name}*:\n"${r.comment}"`).join('\n\n');
    }
  } else if (query.includes('coupon') || query.includes('discount') || query.includes('promo')) {
    const coupons = await productService.getAvailableCoupons();
    if (coupons.length === 0) {
      reply = 'There are no active coupons available at this moment. Check back during our Summer Deal Days!';
    } else {
      reply = 'Here are the active promo coupons you can apply at checkout:\n\n' + 
        coupons.map(c => `- **${c.code}**: ${c.description} (Get ${c.discount_type === 'percentage' ? `${parseFloat(c.discount_value)}%` : `$${parseFloat(c.discount_value)}`} off, minimum order: $${parseFloat(c.minimum_order_amount).toFixed(2)})`).join('\n');
    }
  } else if (query.includes('return') || query.includes('refund') || query.includes('shipping') || query.includes('contact')) {
    const faqs = await searchFAQs(query);
    if (faqs.length === 0) {
      reply = 'Our return policy allows returns within 30 days of delivery. For refund status or support, contact support@myshopee.com.';
    } else {
      reply = faqs.map(f => `### ${f.question}\n${f.answer}`).join('\n\n');
    }
  } else {
    // Try to extract maximum price filter (e.g. "under 50 dollars", "under $100", "below 30")
    let maxPrice = null;
    const priceRegex = /(?:under|below|less\s+than)\s*(?:\$|rs\.?|inr|₹)?\s*(\d+(?:\.\d{1,2})?)(?:\s*(?:dollars?|bucks|usd|rs|inr|rupees?))?/i;
    const priceMatch = query.match(priceRegex);
    
    let processedMessage = userMessage;
    if (priceMatch) {
      maxPrice = parseFloat(priceMatch[1]);
      // Remove the pricing phrase from the message to avoid searching it as a keyword
      processedMessage = userMessage.replace(new RegExp(priceMatch[0].replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'), '');
    }

    // Strip common conversational words to extract core search terms
    const cleanQuery = processedMessage
      .replace(/\brecommend\b/gi, '')
      .replace(/\bshow\b/gi, '')
      .replace(/\bsearch\b/gi, '')
      .replace(/\bfind\b/gi, '')
      .replace(/\bme\b/gi, '')
      .replace(/\bfor\b/gi, '')
      .replace(/\bproduct\b/gi, '')
      .replace(/\bproducts\b/gi, '')
      .replace(/\bitems\b/gi, '')
      .replace(/\bplease\b/gi, '')
      .replace(/\bi\b/gi, '')
      .replace(/\bwant\b/gi, '')
      .replace(/\bneed\b/gi, '')
      .replace(/\bam\b/gi, '')
      .replace(/\blooking\b/gi, '')
      .replace(/\bwould\b/gi, '')
      .replace(/\blike\b/gi, '')
      .replace(/\bany\b/gi, '')
      .replace(/\bsuggest\b/gi, '')
      .replace(/\bcan\b/gi, '')
      .replace(/\byou\b/gi, '')
      .replace(/\bgive\b/gi, '')
      .replace(/\bget\b/gi, '')
      .replace(/\bsome\b/gi, '')
      .replace(/\bgood\b/gi, '')
      .replace(/[\?\.\!]/g, '')
      .trim();

    // Search/recommend products fallback with extracted maxPrice budget limit
    const products = await productService.recommendProducts({ 
      useCase: cleanQuery || processedMessage, 
      maxPrice: maxPrice 
    });
    
    if (products.length === 0) {
      const budgetText = maxPrice ? ` under $${maxPrice}` : '';
      reply = `I couldn't find any recommendations matching "${cleanQuery || processedMessage}"${budgetText}. Try searching for items like 'shoes', 'running', or 'gaming laptop'.`;
    } else {
      const budgetText = maxPrice ? ` under $${maxPrice}` : '';
      reply = `I found some great recommendations for you${budgetText}:\n\n` + 
        products.map(p => `- **${p.title}** by *${p.brand}* (Rating: ${parseFloat(p.rating).toFixed(1)}⭐): $${parseFloat(p.price).toFixed(2)} (ID: **${p.id}**)`).join('\n') + 
        '\n\nYou can ask me to add any of these IDs to your cart (e.g. "Add product 2 to my cart")!';
      metadata = { products: products };
    }
  }

  if (isQuotaFallback) {
    reply += `\n\n*(⚠️ Note: The assistant has temporarily switched to offline simulated mode because the developer's Gemini API key has exceeded its free-tier request quota. I can still process your cart actions, order tracking, returns, and product queries offline.)*`;
  }

  return { reply, metadata };
};

/**
 * Handle new incoming chat message for a session
 */
const sendMessage = async (sessionUuid, userMessage, userId, contextProductId = null) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get or create session
    let sessionRes = await client.query('SELECT * FROM chat_sessions WHERE session_uuid = $1', [sessionUuid]);
    let session;
    if (sessionRes.rows.length === 0) {
      const dbUser = userId || null;
      const title = userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
      
      const newSessionRes = await client.query(
        'INSERT INTO chat_sessions (session_uuid, user_id, title) VALUES ($1, $2, $3) RETURNING *',
        [sessionUuid, dbUser, title]
      );
      session = newSessionRes.rows[0];
    } else {
      session = sessionRes.rows[0];
    }

    // 2. Fetch history messages for the session to build memory
    const historyRes = await client.query(
      'SELECT sender, message, metadata FROM chat_messages WHERE session_id = $1 ORDER BY id ASC',
      [session.id]
    );

    // Save user message in database immediately
    await client.query(
      'INSERT INTO chat_messages (session_id, sender, message) VALUES ($1, $2, $3)',
      [session.id, 'user', userMessage]
    );

    await client.query('COMMIT');

    // Resolve contextProductId from history if not passed from frontend
    let activeContextProductId = contextProductId;
    if (!activeContextProductId) {
      for (let i = historyRes.rows.length - 1; i >= 0; i--) {
        const msg = historyRes.rows[i];
        if (msg.sender === 'bot' && msg.metadata) {
          let meta = msg.metadata;
          if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch(e) {}
          }
          if (meta && meta.products && meta.products.length > 0) {
            activeContextProductId = meta.products[0].id;
            break;
          }
        }
      }
    }

    // 3. Check if running in simulated mock mode
    if (geminiService.isPlaceholderKey) {
      const mockResult = await runMockAgent(userMessage, userId, activeContextProductId, false);
      
      await db.query(
        'INSERT INTO chat_messages (session_id, sender, message, metadata) VALUES ($1, $2, $3, $4)',
        [session.id, 'bot', mockResult.reply, JSON.stringify(mockResult.metadata)]
      );

      return {
        reply: mockResult.reply,
        metadata: mockResult.metadata,
        sessionUuid
      };
    }

    // 4. Build message contents array for Gemini
    const contents = [];
    
    // Add history
    for (const msg of historyRes.rows) {
      if (msg.sender === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.message }]
        });
      } else if (msg.sender === 'bot') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.message }]
        });
      }
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    // 5. Invoke Gemini Agent Loop
    let responseText = '';
    let responseMetadata = {};
    let currentIteration = 0;
    const maxIterations = 5; // Prevent infinite tool loops

    // Prepare system prompt with injected context product details
    let systemInstructionOverride = geminiService.systemInstructionText;
    
    if (activeContextProductId) {
      try {
        const product = await productService.getProductDetails(activeContextProductId);
        if (product) {
          systemInstructionOverride += `\n\nACTIVE CONTEXT (CURRENTLY VIEWED PRODUCT):\n- Product ID: ${product.id}\n- Title: "${product.title}"\n- Category: "${product.category}"\n- Brand: "${product.brand}"\n- Price: $${product.price}\nUse this product context if the user says "this product", "it", "this item", "this shoe", or asks to "add it to cart" or "what do customers think about this product" etc.`;
        }
      } catch (err) {
        console.error('Failed to inject active product details context:', err);
      }
    }

    // Fetch user preferences to inject into system prompt
    if (userId) {
      try {
        const preferences = await productService.getUserPreferences(userId);
        if (preferences && Object.keys(preferences).length > 0) {
          const brandText = preferences.favorite_brands && preferences.favorite_brands.length > 0
            ? preferences.favorite_brands.join(', ')
            : 'None';
          const catText = preferences.favorite_categories && preferences.favorite_categories.length > 0
            ? preferences.favorite_categories.join(', ')
            : 'None';
          const budgetText = preferences.preferred_price_range || 'None';

          systemInstructionOverride += `\n\nUSER PREFERENCES (PERSONALIZATION MEMORY LAYER):\n- Favorite Brands: ${brandText}\n- Favorite Categories: ${catText}\n- Preferred Price Budget: ${budgetText}\nUse these preferences when recommending products unless the user explicitly requests otherwise. Keep your recommendations aligned with this memory layer.`;
        }
      } catch (err) {
        console.error('Failed to inject user preferences into system instruction:', err);
      }
    }

    try {
      while (currentIteration < maxIterations) {
        const geminiResult = await geminiService.generateContent(contents, systemInstructionOverride);
        const parts = geminiResult.content?.parts || [];
        
        // Check if Gemini wants to call a function
        const functionCallPart = parts.find(p => p.functionCall);
        
        if (functionCallPart) {
          const { name, args } = functionCallPart.functionCall;
          
          // Push the function call part into contents history
          contents.push(geminiResult.content);

          // Execute local database tool query
          const toolResult = await executeTool(name, args, userId);

          // Capture recommendations to render product cards on the client side
          if ((name === 'searchProducts' || name === 'recommendProducts' || name === 'compareProducts') && Array.isArray(toolResult)) {
            responseMetadata.products = toolResult;
          } else if (name === 'getProductDetails' && toolResult) {
            responseMetadata.products = [toolResult];
          }

          // Set action flags for state synchronizations
          if (name === 'addToCart' && toolResult && !toolResult.error) {
            responseMetadata.cartUpdated = true;
          }
          if (name === 'addToWishlist' && toolResult && !toolResult.error) {
            responseMetadata.wishlistUpdated = true;
          }

          // Push function response back to Gemini
          contents.push({
            role: 'function',
            parts: [
              {
                functionResponse: {
                  name,
                  response: {
                    name,
                    content: toolResult
                  }
                }
              }
            ]
          });

          currentIteration++;
        } else {
          // Gemini returned a regular text response
          responseText = parts.map(p => p.text).join('\n');
          break;
        }
      }
    } catch (geminiError) {
      console.warn('⚠️ Gemini API execution failed. Falling back to Local Simulated Mock Agent:', geminiError.message);
      
      const mockResult = await runMockAgent(userMessage, userId, activeContextProductId, true);
      responseText = mockResult.reply;
      responseMetadata = mockResult.metadata;
    }

    if (!responseText) {
      responseText = "I'm having trouble retrieving that information right now. Can I help you with another product search or order status?";
    }

    // 6. Save AI response and metadata to message history database
    await db.query(
      'INSERT INTO chat_messages (session_id, sender, message, metadata) VALUES ($1, $2, $3, $4)',
      [session.id, 'bot', responseText, JSON.stringify(responseMetadata)]
    );

    return {
      reply: responseText,
      metadata: responseMetadata,
      sessionUuid
    };

  } catch (error) {
    console.error('Chatbot Agent Error:', error);
    return {
      reply: 'An internal error occurred while processing your message. Please try again.',
      metadata: {},
      sessionUuid
    };
  } finally {
    client.release();
  }
};

/**
 * Retrieve user chat sessions
 */
const getSessions = async (userId) => {
  if (!userId) return [];
  try {
    const result = await db.query(
      `SELECT session_uuid, title, created_at 
       FROM chat_sessions 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error loading chat sessions:', error);
    return [];
  }
};

/**
 * Retrieve messages history for a session
 */
const getMessages = async (sessionUuid, userId) => {
  try {
    const sessionRes = await db.query(
      'SELECT id FROM chat_sessions WHERE session_uuid = $1' + (userId ? ' AND user_id = $2' : ''),
      userId ? [sessionUuid, userId] : [sessionUuid]
    );

    if (sessionRes.rows.length === 0) {
      return [];
    }

    const result = await db.query(
      `SELECT sender, message, metadata, created_at 
       FROM chat_messages 
       WHERE session_id = $1 
       ORDER BY id ASC`,
      [sessionRes.rows[0].id]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }
};

/**
 * Delete a chat session
 */
const deleteSession = async (sessionUuid, userId) => {
  try {
    const result = await db.query(
      'DELETE FROM chat_sessions WHERE session_uuid = $1' + (userId ? ' AND user_id = $2' : '') + ' RETURNING *',
      userId ? [sessionUuid, userId] : [sessionUuid]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return false;
  }
};

module.exports = {
  sendMessage,
  getSessions,
  getMessages,
  deleteSession
};
// Trigger Nodemon Restart
