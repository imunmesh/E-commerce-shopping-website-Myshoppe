const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// Helper to ensure a user has a cart and return its ID
const getOrCreateCartId = async (userId) => {
  let cartResult = await db.query('SELECT id FROM cart WHERE user_id = $1', [userId]);
  if (cartResult.rows.length === 0) {
    const newCart = await db.query('INSERT INTO cart (user_id) VALUES ($1) RETURNING id', [userId]);
    return newCart.rows[0].id;
  }
  return cartResult.rows[0].id;
};

// 1. GET /api/cart - Fetch cart items and summary
router.get('/', verifyToken, async (req, res) => {
  try {
    const cartId = await getOrCreateCartId(req.user.id);
    
    // Fetch items with product details
    const itemsResult = await db.query(
      `SELECT ci.id as cart_item_id, ci.quantity, p.id as product_id, p.title, p.price, p.discount, p.stock,
              (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) as thumbnail
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1
       ORDER BY ci.id ASC`,
      [cartId]
    );

    const items = itemsResult.rows;

    // Perform calculations
    let subtotal = 0;
    let totalDiscount = 0;

    items.forEach(item => {
      const price = parseFloat(item.price);
      const discountPct = parseFloat(item.discount || 0);
      const quantity = parseInt(item.quantity);
      
      const itemSubtotal = price * quantity;
      const itemDiscount = itemSubtotal * (discountPct / 100);

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
    });

    const taxableAmount = subtotal - totalDiscount;
    const taxRate = 0.08; // 8% Tax
    const tax = taxableAmount * taxRate;
    const finalTotal = taxableAmount + tax;

    res.json({
      items,
      summary: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount: parseFloat(totalDiscount.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        total: parseFloat(finalTotal.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Fetch cart error:', error);
    res.status(500).json({ error: 'Failed to fetch cart.' });
  }
});

// 2. POST /api/cart - Add product to cart
router.post('/', verifyToken, async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required.' });
  }

  try {
    // Check if product exists and is in stock
    const productRes = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const inStock = productRes.rows[0].stock;
    if (inStock < quantity) {
      return res.status(400).json({ error: 'Insufficient inventory available.' });
    }

    const cartId = await getOrCreateCartId(req.user.id);

    // Upsert cart item
    const checkItem = await db.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cartId, productId]
    );

    if (checkItem.rows.length > 0) {
      const newQuantity = checkItem.rows[0].quantity + parseInt(quantity);
      if (newQuantity > inStock) {
        return res.status(400).json({ error: `Cannot add more. Limit of ${inStock} in stock reached.` });
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

    res.json({ message: 'Product added to cart successfully.' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add product to cart.' });
  }
});

// 3. PUT /api/cart/items/:itemId - Update item quantity
router.put('/items/:itemId', verifyToken, async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than 0.' });
  }

  try {
    const cartId = await getOrCreateCartId(req.user.id);

    // Fetch the product_id for this cart item to verify stock
    const itemRes = await db.query(
      `SELECT ci.id, ci.product_id, p.stock 
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.id = $1 AND ci.cart_id = $2`,
      [itemId, cartId]
    );

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    const { stock } = itemRes.rows[0];
    if (quantity > stock) {
      return res.status(400).json({ error: `Cannot set quantity. Only ${stock} items left in stock.` });
    }

    await db.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [parseInt(quantity), itemId]);
    res.json({ message: 'Cart item quantity updated successfully.' });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ error: 'Failed to update cart item.' });
  }
});

// 4. DELETE /api/cart/items/:itemId - Remove item from cart
router.delete('/items/:itemId', verifyToken, async (req, res) => {
  const { itemId } = req.params;

  try {
    const cartId = await getOrCreateCartId(req.user.id);

    const result = await db.query(
      'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2 RETURNING *',
      [itemId, cartId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    res.json({ message: 'Item removed from cart successfully.' });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ error: 'Failed to remove cart item.' });
  }
});

// 5. DELETE /api/cart - Clear cart
router.delete('/', verifyToken, async (req, res) => {
  try {
    const cartId = await getOrCreateCartId(req.user.id);
    await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    res.json({ message: 'Cart cleared successfully.' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Failed to clear cart.' });
  }
});

module.exports = router;
