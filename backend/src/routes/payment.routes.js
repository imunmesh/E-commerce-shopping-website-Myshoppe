const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendOrderConfirmationEmail } = require('../utils/email.util');

// Initialize Stripe (will handle fallback if key is a placeholder)
const isPlaceholderKey = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_placeholder');
const stripe = !isPlaceholderKey ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// Helper to create an order inside DB (shares logic between Stripe Webhook and Mock Checkout)
const createOrderFromCheckout = async (userId, itemsString, amount, sessionId, paymentIntentId, addressId, status = 'paid', couponCode = null, discountAmount = 0.00) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Acquire a transaction-level advisory lock on the session ID to serialize concurrent requests.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [sessionId]);

    // 1. Idempotency Check: check if payment session already processed
    const paymentCheck = await client.query(
      'SELECT id, order_id FROM payments WHERE stripe_session_id = $1',
      [sessionId]
    );
    if (paymentCheck.rows.length > 0) {
      console.log(`Checkout session ${sessionId} already processed.`);
      await client.query('COMMIT');
      return { success: true, orderId: paymentCheck.rows[0].order_id, alreadyProcessed: true };
    }

    // 2. Parse Items String ("productId:quantity,productId:quantity")
    const itemPairs = itemsString.split(',');
    const orderItems = [];

    for (const pair of itemPairs) {
      const [prodId, qty] = pair.split(':');
      const productId = parseInt(prodId);
      const quantity = parseInt(qty);

      // Verify product price, stock & image
      const productRes = await client.query('SELECT title, price, stock, thumbnail FROM products WHERE id = $1', [productId]);
      if (productRes.rows.length === 0) {
        throw new Error(`Product with ID ${productId} not found during checkout order creation.`);
      }

      const { title, price, stock, thumbnail } = productRes.rows[0];
      if (stock < quantity) {
        throw new Error(`Insufficient stock for product: ${title}`);
      }

      orderItems.push({ productId, quantity, price: parseFloat(price), title, thumbnail });
    }

    // Verify Address exists and belongs to the user
    if (!addressId) {
      throw new Error('Delivery address ID is missing for this order.');
    }
    const addressRes = await client.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
      [addressId, userId]
    );
    if (addressRes.rows.length === 0) {
      throw new Error(`Delivery address with ID ${addressId} was not found.`);
    }
    const addr = addressRes.rows[0];

    // 3. Create the Order
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, total_amount, payment_status, order_status, coupon_code, discount_amount) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, amount, 'paid', 'Placed', couponCode || null, discountAmount || 0.00]
    );
    const newOrder = orderRes.rows[0];

    // Increment coupon usage
    if (couponCode) {
      await client.query(
        'UPDATE coupons SET used_count = used_count + 1 WHERE UPPER(code) = UPPER($1)',
        [couponCode.trim().toUpperCase()]
      );
    }

    // Create Order Address Snapshot
    await client.query(
      `INSERT INTO order_addresses 
       (order_id, full_name, phone, address_line_1, address_line_2, landmark, city, state, country, pincode, address_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        newOrder.id,
        addr.full_name,
        addr.phone,
        addr.address_line_1,
        addr.address_line_2,
        addr.landmark,
        addr.city,
        addr.state,
        addr.country,
        addr.pincode,
        addr.address_type
      ]
    );

    // 4. Create Order Items & Deduct Stock
    for (const item of orderItems) {
      // Insert item
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) 
         VALUES ($1, $2, $3, $4)`,
        [newOrder.id, item.productId, item.quantity, item.price]
      );

      // Deduct stock
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.productId]
      );
    }

    // 5. Create Order Tracking entry
    await client.query(
      `INSERT INTO order_tracking (order_id, status, message) 
       VALUES ($1, $2, $3)`,
      [newOrder.id, 'Placed', 'Order has been successfully placed and paid.']
    );

    // 6. Record Payment
    await client.query(
      `INSERT INTO payments (user_id, order_id, stripe_session_id, stripe_payment_intent_id, amount, currency, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, newOrder.id, sessionId, paymentIntentId, amount, 'usd', status]
    );

    // 7. Clear user's cart
    const cartRes = await client.query('SELECT id FROM cart WHERE user_id = $1', [userId]);
    if (cartRes.rows.length > 0) {
      await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartRes.rows[0].id]);
    }

    await client.query('COMMIT');

    // 8. Fetch user details and trigger confirmation email asynchronously
    const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length > 0) {
      sendOrderConfirmationEmail(userRes.rows[0], newOrder, orderItems, addr)
        .catch(err => console.error('Error triggering confirmation email:', err));
    }

    return { success: true, orderId: newOrder.id };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Order creation transaction failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

// 1. POST /api/payment/create-checkout-session
router.post('/create-checkout-session', verifyToken, async (req, res) => {
  try {
    const { addressId, couponCode } = req.body;
    if (!addressId) {
      return res.status(400).json({ error: 'A valid delivery address is required to proceed.' });
    }

    // Validate that address exists and belongs to user
    const addressRes = await db.query(
      'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
      [addressId, req.user.id]
    );
    if (addressRes.rows.length === 0) {
      return res.status(400).json({ error: 'Selected delivery address is invalid or not found.' });
    }

    // Get user cart items
    const cartRes = await db.query('SELECT id FROM cart WHERE user_id = $1', [req.user.id]);
    if (cartRes.rows.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }
    const cartId = cartRes.rows[0].id;

    const itemsRes = await db.query(
      `SELECT ci.quantity, p.id, p.title, p.price, p.discount, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    if (itemsRes.rows.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    // Verify stock and prepare items metadata
    const metadataItems = [];
    const stripeLineItems = [];
    let subtotal = 0;
    let totalDiscount = 0;

    for (const item of itemsRes.rows) {
      if (item.stock < item.quantity) {
        return res.status(400).json({ error: `Product "${item.title}" has insufficient stock.` });
      }

      metadataItems.push(`${item.id}:${item.quantity}`);

      const originalPrice = parseFloat(item.price);
      const discountPct = parseFloat(item.discount || 0);
      const discountedPrice = originalPrice * (1 - discountPct / 100);

      subtotal += originalPrice * item.quantity;
      totalDiscount += (originalPrice * discountPct / 100) * item.quantity;

      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.title,
            description: discountPct > 0 
              ? `Discounted by ${discountPct}% (Original: $${originalPrice.toFixed(2)})` 
              : `Quality product from MyShopee - ${item.title}`,
          },
          unit_amount: Math.round(discountedPrice * 100), // in cents
        },
        quantity: item.quantity,
      });
    }

    // Calculate tax and total for session matching
    const taxableAmount = subtotal - totalDiscount;

    // Process coupon if provided
    let coupon = null;
    let appliedDiscount = 0;

    if (couponCode) {
      const couponRes = await db.query('SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)', [couponCode.trim()]);
      if (couponRes.rows.length === 0) {
        return res.status(400).json({ error: 'Coupon code does not exist.' });
      }
      coupon = couponRes.rows[0];

      if (!coupon.is_active) {
        return res.status(400).json({ error: 'This coupon is no longer active.' });
      }
      if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
        return res.status(400).json({ error: 'This coupon has expired.' });
      }
      if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
        return res.status(400).json({ error: 'This coupon has reached its usage limit.' });
      }
      if (coupon.minimum_order_amount && taxableAmount < parseFloat(coupon.minimum_order_amount)) {
        return res.status(400).json({ 
          error: `Minimum order amount of $${parseFloat(coupon.minimum_order_amount).toFixed(2)} is required to use this coupon.` 
        });
      }

      // Calculate discount amount
      const value = parseFloat(coupon.discount_value);
      if (coupon.discount_type === 'percentage') {
        appliedDiscount = taxableAmount * (value / 100);
      } else if (coupon.discount_type === 'fixed') {
        appliedDiscount = value;
      }

      if (appliedDiscount > taxableAmount) {
        appliedDiscount = taxableAmount;
      }
    }

    const finalTaxableAmount = taxableAmount - appliedDiscount;
    const tax = finalTaxableAmount * 0.08;
    const totalAmount = finalTaxableAmount + tax;

    // Recalculate line items scaling them down by coupon discount
    const discountFactor = taxableAmount > 0 ? finalTaxableAmount / taxableAmount : 0;
    
    for (const item of itemsRes.rows) {
      const originalPrice = parseFloat(item.price);
      const discountPct = parseFloat(item.discount || 0);
      const discountedPrice = originalPrice * (1 - discountPct / 100) * discountFactor;

      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.title,
            description: discountPct > 0 
              ? `Discounted by ${discountPct}% (Original: $${originalPrice.toFixed(2)})` 
              : `Quality product from MyShopee - ${item.title}`,
          },
          unit_amount: Math.round(discountedPrice * 100), // in cents
        },
        quantity: item.quantity,
      });
    }

    // Add Tax as a separate line item for clarity
    if (tax > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Tax (8%)',
          },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    const itemsMetadataString = metadataItems.join(',');

    // A. MOCK CHECKOUT FLOW
    if (isPlaceholderKey) {
      const mockSessionId = `mock_sess_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      console.log('Stripe API Key is a placeholder. Returning simulated mock session ID:', mockSessionId);
      
      return res.json({
        id: mockSessionId,
        url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout/success?session_id=${mockSessionId}&mock=true&items=${encodeURIComponent(itemsMetadataString)}&amount=${totalAmount.toFixed(2)}&address_id=${addressId}&coupon_code=${encodeURIComponent(couponCode || '')}&discount_amount=${appliedDiscount.toFixed(2)}`,
        isMock: true
      });
    }

    // B. REAL STRIPE FLOW
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: stripeLineItems,
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout/cancel`,
      metadata: {
        userId: req.user.id.toString(),
        items: itemsMetadataString,
        email: req.user.email,
        addressId: addressId.toString(),
        couponCode: couponCode || '',
        discountAmount: appliedDiscount.toFixed(2)
      }
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate payment checkout.' });
  }
});

// 2. POST /api/payment/mock-webhook - For simulating order placement on Mock Checkout landing
router.post('/mock-webhook', verifyToken, async (req, res) => {
  const { sessionId, items, amount, addressId, couponCode, discountAmount } = req.body;
  if (!sessionId || !items || !amount || !addressId) {
    return res.status(400).json({ error: 'Missing parameters for mock checkout session (sessionId, items, amount, and addressId are all required).' });
  }

  try {
    const result = await createOrderFromCheckout(
      req.user.id,
      items,
      parseFloat(amount),
      sessionId,
      `mock_intent_${Date.now()}`,
      parseInt(addressId),
      'succeeded',
      couponCode || null,
      discountAmount ? parseFloat(discountAmount) : 0.00
    );
    res.json({ message: 'Simulated checkout success.', orderId: result.orderId });
  } catch (error) {
    console.error('Mock webhook failed:', error);
    res.status(500).json({ error: error.message || 'Failed to simulate payment processing.' });
  }
});

// 3. POST /api/payment/confirm-payment - Confirm a real Stripe checkout session and create order
router.post('/confirm-payment', verifyToken, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  try {
    if (isPlaceholderKey) {
      return res.status(400).json({ error: 'Stripe is disabled - placeholder keys are configured.' });
    }

    // Retrieve session from Stripe to verify status and get metadata
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Stripe checkout session not found.' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Stripe checkout session is not paid yet.' });
    }

    const { userId, items, addressId, couponCode, discountAmount } = session.metadata;
    const totalAmount = session.amount_total / 100; // in dollars
    const paymentIntentId = session.payment_intent;

    // Verify session belongs to the logged in user
    if (parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized checkout session confirmation.' });
    }

    const result = await createOrderFromCheckout(
      parseInt(userId),
      items,
      totalAmount,
      sessionId,
      paymentIntentId,
      parseInt(addressId),
      'succeeded',
      couponCode || null,
      discountAmount ? parseFloat(discountAmount) : 0.00
    );

    res.json({ message: 'Payment confirmed and order created successfully.', orderId: result.orderId });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm Stripe payment.' });
  }
});

// 4. POST /api/payment/webhook - Real Stripe Webhook Signature verified endpoint
router.post('/webhook', async (req, res) => {
  if (isPlaceholderKey) {
    return res.status(400).send('Stripe webhook disabled - placeholder keys are configured.');
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle Event
  const session = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      console.log('Payment checkout session completed event received.');
      const { userId, items, email, addressId, couponCode, discountAmount } = session.metadata;
      const totalAmount = session.amount_total / 100; // in dollars
      const sessionId = session.id;
      const paymentIntentId = session.payment_intent;

      try {
        await createOrderFromCheckout(
          parseInt(userId),
          items,
          totalAmount,
          sessionId,
          paymentIntentId,
          parseInt(addressId),
          'succeeded',
          couponCode || null,
          discountAmount ? parseFloat(discountAmount) : 0.00
        );
      } catch (err) {
        console.error('Stripe webhook checkout processing failed:', err);
        return res.status(500).send(`Processing Error: ${err.message}`);
      }
      break;
    }

    case 'payment_intent.succeeded':
      console.log('Payment intent succeeded:', session.id);
      break;

    case 'payment_intent.payment_failed':
      console.warn('Payment intent failed:', session.id);
      break;

    case 'charge.refunded':
      console.log('Charge refunded:', session.id);
      // Can implement order status update to refunded here
      break;

    default:
      console.log(`Unhandled webhook event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
