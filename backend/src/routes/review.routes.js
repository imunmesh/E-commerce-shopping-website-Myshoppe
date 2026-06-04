const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

// Helper to recalculate and sync product rating
const updateProductRating = async (productId, dbClient) => {
  const queryExecutor = dbClient || db;
  
  // Calculate average
  const ratingRes = await queryExecutor.query(
    'SELECT AVG(rating) as avg_rating FROM reviews WHERE product_id = $1',
    [productId]
  );
  
  const avgRating = parseFloat(ratingRes.rows[0].avg_rating || 0).toFixed(2);

  // Update product table
  await queryExecutor.query(
    'UPDATE products SET rating = $1 WHERE id = $2',
    [avgRating, productId]
  );
};

// 1. POST /api/reviews - Add a review (limit 1 review per user per product, supports product image upload)
router.post('/', verifyToken, upload.single('reviewImage'), async (req, res) => {
  const { productId, rating, comment } = req.body;
  const userId = req.user.id;

  const parsedProductId = parseInt(productId);
  const parsedRating = parseInt(rating);

  if (!parsedProductId || !parsedRating || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({ error: 'Product ID and a rating between 1 and 5 are required.' });
  }

  const imageUrl = req.file ? req.file.path : null;
  const imagePublicId = req.file ? req.file.filename : null;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user already reviewed
    const checkRes = await client.query(
      'SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2',
      [parsedProductId, userId]
    );

    if (checkRes.rows.length > 0) {
      // If an image was uploaded but creation fails, clean it up from Cloudinary
      if (imagePublicId) {
        await cloudinary.uploader.destroy(imagePublicId);
      }
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already reviewed this product. Please edit your existing review.' });
    }

    // Insert review
    await client.query(
      `INSERT INTO reviews (product_id, user_id, rating, comment, image_url, image_public_id) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [parsedProductId, userId, parsedRating, comment, imageUrl, imagePublicId]
    );

    // Sync product rating
    await updateProductRating(parsedProductId, client);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Review added successfully.' });
  } catch (error) {
    if (imagePublicId) {
      try {
        await cloudinary.uploader.destroy(imagePublicId);
      } catch (err) {
        console.error('Failed to clean up Cloudinary upload after error:', err);
      }
    }
    await client.query('ROLLBACK');
    console.error('Add review error:', error);
    res.status(500).json({ error: 'Failed to submit review.' });
  } finally {
    client.release();
  }
});

// 2. PUT /api/reviews/:id - Edit an existing review
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user.id;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating between 1 and 5 is required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership and get product ID
    const reviewCheck = await client.query(
      'SELECT product_id FROM reviews WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (reviewCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Review not found or unauthorized.' });
    }

    const { product_id } = reviewCheck.rows[0];

    // Update review
    await client.query(
      'UPDATE reviews SET rating = $1, comment = $2 WHERE id = $3',
      [rating, comment, id]
    );

    // Sync product rating
    await updateProductRating(product_id, client);

    await client.query('COMMIT');
    res.json({ message: 'Review updated successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Edit review error:', error);
    res.status(500).json({ error: 'Failed to update review.' });
  } finally {
    client.release();
  }
});

// 3. DELETE /api/reviews/:id - Delete review (and associated Cloudinary asset)
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership and get product ID + image ID
    const reviewCheck = await client.query(
      'SELECT product_id, image_public_id FROM reviews WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (reviewCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Review not found or unauthorized.' });
    }

    const { product_id, image_public_id } = reviewCheck.rows[0];

    // Clean up review image from Cloudinary
    if (image_public_id) {
      await cloudinary.uploader.destroy(image_public_id);
    }

    // Delete review
    await client.query('DELETE FROM reviews WHERE id = $1', [id]);

    // Sync product rating
    await updateProductRating(product_id, client);

    await client.query('COMMIT');
    res.json({ message: 'Review deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review.' });
  } finally {
    client.release();
  }
});

module.exports = router;
