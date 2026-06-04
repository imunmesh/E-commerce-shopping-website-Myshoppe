const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// 1. GET /api/wishlist - Fetch user wishlist
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT w.id as wishlist_id, p.id as product_id, p.title, p.price, p.discount, p.rating, p.stock,
              (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) as thumbnail
       FROM wishlist w
       JOIN products p ON w.product_id = p.id
       WHERE w.user_id = $1
       ORDER BY w.id DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch wishlist error:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist.' });
  }
});

// 2. POST /api/wishlist - Add product to wishlist
router.post('/', verifyToken, async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required.' });
  }

  try {
    // Check if product exists
    const prodCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (prodCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Insert into wishlist, ignore if already exists (via UNIQUE constraint)
    await db.query(
      `INSERT INTO wishlist (user_id, product_id) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [req.user.id, productId]
    );

    res.json({ message: 'Product added to wishlist.' });
  } catch (error) {
    console.error('Add wishlist error:', error);
    res.status(500).json({ error: 'Failed to add to wishlist.' });
  }
});

// 3. DELETE /api/wishlist/:productId - Remove product from wishlist
router.delete('/:productId', verifyToken, async (req, res) => {
  const { productId } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2 RETURNING *',
      [req.user.id, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found in wishlist.' });
    }

    res.json({ message: 'Product removed from wishlist.' });
  } catch (error) {
    console.error('Remove wishlist error:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist.' });
  }
});

// 4. POST /api/wishlist/:productId/move-to-cart - Move item from wishlist to cart
router.post('/:productId/move-to-cart', verifyToken, async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify item is in wishlist
    const wishCheck = await client.query(
      'SELECT id FROM wishlist WHERE user_id = $1 AND product_id = $2',
      [userId, productId]
    );

    if (wishCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product is not in your wishlist.' });
    }

    // 2. Fetch stock level
    const prodRes = await client.query('SELECT stock FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product does not exist.' });
    }

    const { stock } = prodRes.rows[0];
    if (stock <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Product is out of stock and cannot be moved to cart.' });
    }

    // 3. Add to cart (get cart ID first)
    let cartRes = await client.query('SELECT id FROM cart WHERE user_id = $1', [userId]);
    let cartId;
    if (cartRes.rows.length === 0) {
      const newCart = await client.query('INSERT INTO cart (user_id) VALUES ($1) RETURNING id', [userId]);
      cartId = newCart.rows[0].id;
    } else {
      cartId = cartRes.rows[0].id;
    }

    // 4. Insert or update quantity in cart_items
    const checkItem = await client.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cartId, productId]
    );

    if (checkItem.rows.length > 0) {
      const newQty = checkItem.rows[0].quantity + 1;
      if (newQty > stock) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot add more. Limit of stock reached.' });
      }
      await client.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [newQty, checkItem.rows[0].id]);
    } else {
      await client.query(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, 1)',
        [cartId, productId]
      );
    }

    // 5. Delete from wishlist
    await client.query('DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2', [userId, productId]);

    await client.query('COMMIT');
    res.json({ message: 'Product moved to cart successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Move to cart transaction error:', error);
    res.status(500).json({ error: 'Failed to move product to cart.' });
  } finally {
    client.release();
  }
});

module.exports = router;
