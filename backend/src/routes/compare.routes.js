const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// 1. GET /api/compare - Retrieve products in comparison list (max 4)
router.get('/', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT ch.created_at, p.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', pi.id,
                    'image_url', pi.image_url,
                    'public_id', pi.public_id,
                    'is_primary', pi.is_primary
                  )
                ) FILTER (WHERE pi.image_url IS NOT NULL),
                '[]'
              ) as images
       FROM comparison_history ch
       JOIN products p ON ch.product_id = p.id
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE ch.user_id = $1
       GROUP BY ch.id, p.id
       ORDER BY ch.created_at ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch comparison history error:', error);
    res.status(500).json({ error: 'Failed to fetch comparison products.' });
  }
});

// 2. POST /api/compare - Add product to comparison list
router.post('/', verifyToken, async (req, res) => {
  const { productId } = req.body;
  const userId = req.user.id;

  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required.' });
  }

  try {
    // Check if product exists
    const prodRes = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Check current count
    const countRes = await db.query('SELECT COUNT(*) FROM comparison_history WHERE user_id = $1', [userId]);
    const currentCount = parseInt(countRes.rows[0].count);

    // Check if already exists in list
    const existRes = await db.query(
      'SELECT id FROM comparison_history WHERE user_id = $1 AND product_id = $2',
      [userId, productId]
    );

    if (existRes.rows.length > 0) {
      return res.status(400).json({ error: 'Product is already in your comparison list.' });
    }

    if (currentCount >= 4) {
      return res.status(400).json({ error: 'You can compare up to 4 products at a time. Please remove an item first.' });
    }

    await db.query(
      'INSERT INTO comparison_history (user_id, product_id) VALUES ($1, $2)',
      [userId, productId]
    );

    res.status(201).json({ message: 'Product added to comparison list.' });
  } catch (error) {
    console.error('Add comparison error:', error);
    res.status(500).json({ error: 'Failed to add product to comparison list.' });
  }
});

// 3. DELETE /api/compare/:productId - Remove product from comparison list
router.delete('/:productId', verifyToken, async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;

  try {
    const result = await db.query(
      'DELETE FROM comparison_history WHERE user_id = $1 AND product_id = $2 RETURNING *',
      [userId, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found in your comparison list.' });
    }

    res.json({ message: 'Product removed from comparison list.' });
  } catch (error) {
    console.error('Delete comparison error:', error);
    res.status(500).json({ error: 'Failed to remove product from comparison list.' });
  }
});

module.exports = router;
