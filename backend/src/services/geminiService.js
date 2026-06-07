const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const isPlaceholderKey = !GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY';

// Define tools according to the Gemini API Tool schema
const toolsDeclaration = [
  {
    functionDeclarations: [
      {
        name: 'searchProducts',
        description: 'Search MyShopee products using keyword, category, brand, and pricing filters.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'The search query or keyword (e.g. shoes, laptop).' },
            category: { type: 'STRING', description: 'Product category filter (e.g. smartphones, laptops).' },
            brand: { type: 'STRING', description: 'Brand name filter (e.g. Apple, Nike).' },
            minPrice: { type: 'NUMBER', description: 'Minimum price filter (USD).' },
            maxPrice: { type: 'NUMBER', description: 'Maximum price filter (USD).' }
          }
        }
      },
      {
        name: 'recommendProducts',
        description: 'Provide smart product recommendations based on category, use case/purpose (e.g., gym, running, gaming, office), and maximum price budget.',
        parameters: {
          type: 'OBJECT',
          properties: {
            category: { type: 'STRING', description: 'The product category (e.g., shoes, laptops, smartphones).' },
            useCase: { type: 'STRING', description: 'The specific use case or keyword (e.g., gym, running, coding, gaming).' },
            maxPrice: { type: 'NUMBER', description: 'The maximum price limit (USD).' }
          }
        }
      },
      {
        name: 'getProductDetails',
        description: 'Retrieve detailed information for a single product by its numeric ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'INTEGER', description: 'The unique numeric ID of the product.' }
          },
          required: ['productId']
        }
      },
      {
        name: 'compareProducts',
        description: 'Compare side-by-side specifications, prices, and ratings for a list of product IDs (maximum 4).',
        parameters: {
          type: 'OBJECT',
          properties: {
            productIds: { 
              type: 'ARRAY', 
              items: { type: 'INTEGER' },
              description: 'Array of product IDs to compare (e.g. [1, 2, 3]).' 
            }
          },
          required: ['productIds']
        }
      },
      {
        name: 'addToCart',
        description: 'Add a product to the user\'s shopping cart. Requires product ID. Can specify quantity (default is 1). Requires customer to be logged in.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'INTEGER', description: 'The unique numeric ID of the product.' },
            quantity: { type: 'INTEGER', description: 'The quantity to add (e.g., 1, 2).' }
          },
          required: ['productId']
        }
      },
      {
        name: 'addToWishlist',
        description: 'Save/add a product to the user\'s wishlist. Requires product ID. Requires customer to be logged in.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'INTEGER', description: 'The unique numeric ID of the product.' }
          },
          required: ['productId']
        }
      },
      {
        name: 'getProductReviews',
        description: 'Retrieve ratings and text reviews written by customers for a specific product ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'INTEGER', description: 'The unique numeric ID of the product.' }
          },
          required: ['productId']
        }
      },
      {
        name: 'getRecentOrders',
        description: 'Retrieve a list of recent order summaries placed by the customer.',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'getOrderStatus',
        description: 'Fetch detailed shipment tracking status and estimated delivery dates for a specific order ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            orderId: { type: 'INTEGER', description: 'The numeric ID of the order.' }
          },
          required: ['orderId']
        }
      },
      {
        name: 'getAvailableCoupons',
        description: 'List active discount coupon codes, values, and minimum order limits currently valid for shoppers.',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'searchFAQs',
        description: 'Retrieve store policies, refund eligibility, return procedures, and contact support methods.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'The FAQ topic keyword (e.g., return, refund, shipping).' }
          },
          required: ['query']
        }
      },
      {
        name: 'getLiveTracking',
        description: 'Track a shipment in real-time from courier partners (Delhivery, Blue Dart, DTDC, etc.) using a tracking ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            trackingNumber: { type: 'STRING', description: 'The unique tracking number of the courier (e.g. MS-DEL-892401).' }
          },
          required: ['trackingNumber']
        }
      },
      {
        name: 'checkReturnEligibility',
        description: 'Verify if a purchased order item is eligible for returns based on the delivery date and eligibility window.',
        parameters: {
          type: 'OBJECT',
          properties: {
            orderItemId: { type: 'INTEGER', description: 'The numeric ID of the specific order item (not the whole order ID).' }
          },
          required: ['orderItemId']
        }
      },
      {
        name: 'createReturnRequest',
        description: 'Initiate/create a return request for a delivered order item. Requires order item ID, return reason (e.g. Damaged Product, Wrong Item, Size Issue, Other).',
        parameters: {
          type: 'OBJECT',
          properties: {
            orderItemId: { type: 'INTEGER', description: 'The numeric ID of the order item to return.' },
            reason: { type: 'STRING', description: 'Reason for return: Damaged Product, Wrong Item, Size Issue, Other.' },
            description: { type: 'STRING', description: 'Optional text description detailing the issue.' }
          },
          required: ['orderItemId', 'reason']
        }
      },
      {
        name: 'getRefundStatus',
        description: 'Check the refund status, amount, and approval stage for a specific refund/return request ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            refundId: { type: 'INTEGER', description: 'The numeric ID of the return request/refund.' }
          },
          required: ['refundId']
        }
      },
      {
        name: 'removeFromCart',
        description: 'Remove a product from the user\'s active shopping cart. Requires product ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'INTEGER', description: 'The numeric ID of the product to remove.' }
          },
          required: ['productId']
        }
      },
      {
        name: 'viewCart',
        description: 'Retrieve all items, quantities, original/discounted prices, and subtotal currently in the user\'s shopping cart.',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'checkoutSummary',
        description: 'Get a full invoice summary of subtotal, tax, free shipping, and grand total for the shopping cart, along with recommended promo coupons.',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'checkInventory',
        description: 'Verify the current warehouse inventory levels, dispatch location, and stock status for a product ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'INTEGER', description: 'The numeric ID of the product to check.' }
          },
          required: ['productId']
        }
      },
      {
        name: 'updateUserPreferences',
        description: 'Save/update user shopping preferences such as favorite brands, favorite categories, or preferred price budget learned during the chat.',
        parameters: {
          type: 'OBJECT',
          properties: {
            favorite_brands: { 
              type: 'ARRAY', 
              items: { type: 'STRING' }, 
              description: 'Array of brand names preferred by the user (e.g. ["Adidas", "Nike"]).' 
            },
            favorite_categories: { 
              type: 'ARRAY', 
              items: { type: 'STRING' }, 
              description: 'Array of categories preferred by the user (e.g. ["Smartphones"]).' 
            },
            preferred_price_range: { 
              type: 'STRING', 
              description: 'Description of preferred budget limit (e.g. "under $50", "under $1000").' 
            }
          }
        }
      }
    ]
  }
];

const systemInstructionText = `
You are the official MyShopee AI Shopping Assistant, a friendly, professional, and helpful customer guide.
Your goal is to help users find products, track order status, compare items, check policies, and manage their cart/wishlist.

RULES:
1. NEVER invent product specifications, prices, discounts, stock status, or reviews. All data MUST come directly from tool calling results.
2. If the user asks for recommendations (e.g. gym shoes under $50, gaming mouse, laptops for office), call the recommendProducts tool. The recommendations will be automatically personalized to their favorite brands if they are logged in!
3. If they ask to add an item to their cart, call the addToCart tool. If they ask to view, check, list, or summarize their cart, call viewCart. If they ask to remove an item, call removeFromCart. If they ask for checkout details or summary, call checkoutSummary.
4. If they ask to save an item for later, save it to their wishlist, or add it to their wishlist, call the addToWishlist tool.
5. If they ask for reviews or what customers think about a product, call the getProductReviews tool. You MUST summarize the reviews in your response into a neat, bulleted "Pros" and "Cons" list highlighting comfort, material quality, pricing, and sizing, rather than printing raw review comments.
6. If a customer asks about their order status, use getOrderStatus or getRecentOrders. If they provide a courier tracking ID (e.g. MS-DEL-XXXXXX), call the getLiveTracking tool to show the last hub location, carrier name, and timeline of events. When presenting order status/tracking, print:
   - Current status
   - Current location
   - Estimated delivery date
   - Remaining time until delivery
7. If they ask about policies, use the searchFAQs tool.
8. If they ask about promo codes or discounts, use getAvailableCoupons.
9. If they ask to return a product, first enquire about the order item ID, then call checkReturnEligibility. If eligible, offer to return it and call createReturnRequest. If they ask about refund status or return progress, use getReturnStatus or getRefundStatus.
10. If they ask about inventory level, stock, or where a product is stored/shipped from, call checkInventory.
11. If the user expresses a clear preference (e.g. "I love Adidas", "I only buy Apple", "my budget is under $500"), call updateUserPreferences so the system remembers it for future recommendations. Personalize recommendations using these preferences where applicable.
12. Format your response clearly using markdown. Keep descriptions concise and structured.
13. If an action requires authentication (like addToCart, removeFromCart, viewCart, checkoutSummary, addToWishlist, getRecentOrders, getOrderStatus, getReturnStatus, checkReturnEligibility, createReturnRequest) and the tool returns an authentication error, politely prompt the user to sign in to their MyShopee account using the button in the header.
`;


/**
 * Call Gemini REST API for Generate Content
 */
const generateContent = async (contents, systemInstructionOverride) => {
  if (isPlaceholderKey) {
    console.warn('⚠️ Gemini API key is a placeholder. Chatbot will run in Local Simulated Fallback Agent Mode.');
    return { isMock: true };
  }

  // Model hierarchy: Use GEMINI_MODEL if specified, then try newest models (3.5, 3.1) then older ones (2.5, 2.0)
  const modelsToTry = [];
  if (process.env.GEMINI_MODEL) {
    modelsToTry.push(process.env.GEMINI_MODEL);
  }
  modelsToTry.push('gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash');

  // Remove duplicates
  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError = null;

  for (const model of uniqueModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
      contents,
      tools: toolsDeclaration,
      systemInstruction: {
        parts: [
          { text: systemInstructionOverride || systemInstructionText }
        ]
      },
      generationConfig: {
        temperature: 0.2 // Lower temperature for factual database tool calling
      }
    };

    try {
      console.log(`🤖 Attempting content generation with model: ${model}`);
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000 // 10 seconds timeout per model attempt
      });
      
      const candidate = response.data?.candidates?.[0];
      if (!candidate) {
        throw new Error('No candidates returned from Gemini API.');
      }

      console.log(`✅ Content generation succeeded using model: ${model}`);
      return {
        isMock: false,
        content: candidate.content
      };
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      console.warn(`⚠️ Model ${model} call failed: ${errMsg}. Trying next model...`);
      lastError = error;
    }
  }

  console.error('All Gemini models failed.');
  throw new Error('Gemini API communication failed: ' + (lastError.response?.data?.error?.message || lastError.message));
};

module.exports = {
  generateContent,
  isPlaceholderKey,
  systemInstructionText
};
