const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// 1. GET /api/coupons/validate - Validate a coupon code for checkout
router.get('/validate', verifyToken, async (req, res) => {
  const { code, amount } = req.query;
  const parsedAmount = parseFloat(amount || 0);

  if (!code) {
    return res.status(400).json({ error: 'Coupon code is required.' });
  }

  try {
    const couponRes = await db.query('SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)', [code.trim()]);
    
    if (couponRes.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon code does not exist.' });
    }

    const coupon = couponRes.rows[0];

    // Check active status
    if (!coupon.is_active) {
      return res.status(400).json({ error: 'This coupon is no longer active.' });
    }

    // Check expiry
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      return res.status(400).json({ error: 'This coupon has expired.' });
    }

    // Check usage limits
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ error: 'This coupon has reached its maximum usage limit.' });
    }

    // Check minimum order amount
    if (coupon.minimum_order_amount && parsedAmount < parseFloat(coupon.minimum_order_amount)) {
      return res.status(400).json({ 
        error: `Minimum purchase amount of $${parseFloat(coupon.minimum_order_amount).toFixed(2)} is required to use this coupon.` 
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    const value = parseFloat(coupon.discount_value);

    if (coupon.discount_type === 'percentage') {
      discountAmount = parsedAmount * (value / 100);
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = value;
    }

    // Cap discount at total amount
    if (discountAmount > parsedAmount) {
      discountAmount = parsedAmount;
    }

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        minimum_order_amount: coupon.minimum_order_amount
      },
      discountAmount: parseFloat(discountAmount.toFixed(2))
    });

  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Failed to validate coupon.' });
  }
});

// 2. GET /api/coupons - Get all coupons (Admin only)
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM coupons ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch coupons error:', error);
    res.status(500).json({ error: 'Failed to fetch coupons.' });
  }
});

// 3. POST /api/coupons - Create a coupon (Admin only)
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  const { code, description, discount_type, discount_value, minimum_order_amount, usage_limit, expiry_date, is_active } = req.body;

  if (!code || !discount_type || discount_value === undefined) {
    return res.status(400).json({ error: 'Code, discount type, and discount value are required.' });
  }

  if (discount_type !== 'percentage' && discount_type !== 'fixed') {
    return res.status(400).json({ error: 'Discount type must be percentage or fixed.' });
  }

  try {
    // Check if code exists
    const checkRes = await db.query('SELECT id FROM coupons WHERE UPPER(code) = UPPER($1)', [code.trim()]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: 'A coupon with this code already exists.' });
    }

    const result = await db.query(
      `INSERT INTO coupons 
       (code, description, discount_type, discount_value, minimum_order_amount, usage_limit, expiry_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        code.trim().toUpperCase(),
        description || null,
        discount_type,
        parseFloat(discount_value),
        minimum_order_amount ? parseFloat(minimum_order_amount) : 0,
        usage_limit ? parseInt(usage_limit) : null,
        expiry_date ? new Date(expiry_date) : null,
        is_active !== undefined ? is_active : true
      ]
    );

    res.status(201).json({ message: 'Coupon created successfully.', coupon: result.rows[0] });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Failed to create coupon.' });
  }
});

// 4. PUT /api/coupons/:id - Update a coupon (Admin only)
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { description, discount_type, discount_value, minimum_order_amount, usage_limit, expiry_date, is_active } = req.body;

  if (!discount_type || discount_value === undefined) {
    return res.status(400).json({ error: 'Discount type and discount value are required.' });
  }

  try {
    const result = await db.query(
      `UPDATE coupons 
       SET description = $1, 
           discount_type = $2, 
           discount_value = $3, 
           minimum_order_amount = $4, 
           usage_limit = $5, 
           expiry_date = $6, 
           is_active = $7
       WHERE id = $8 
       RETURNING *`,
      [
        description || null,
        discount_type,
        parseFloat(discount_value),
        minimum_order_amount ? parseFloat(minimum_order_amount) : 0,
        usage_limit ? parseInt(usage_limit) : null,
        expiry_date ? new Date(expiry_date) : null,
        is_active !== undefined ? is_active : true,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found.' });
    }

    res.json({ message: 'Coupon updated successfully.', coupon: result.rows[0] });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ error: 'Failed to update coupon.' });
  }
});

// 5. DELETE /api/coupons/:id - Delete a coupon (Admin only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM coupons WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found.' });
    }
    res.json({ message: 'Coupon deleted successfully.' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Failed to delete coupon.' });
  }
});

module.exports = router;
