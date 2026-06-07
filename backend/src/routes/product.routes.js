const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

// 1. Get all products with filters, sorting, and pagination
router.get('/', async (req, res) => {
  const { search, category, brand, minPrice, maxPrice, sort, order, page = 1, limit = 12 } = req.query;

  let queryText = `
    SELECT p.*, 
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
    FROM products p
    LEFT JOIN product_images pi ON p.id = pi.product_id
  `;

  let countQueryText = `SELECT COUNT(*) FROM products p`;

  const whereClauses = [];
  const params = [];
  let paramIdx = 1;

  // Search filter
  if (search) {
    whereClauses.push(`(p.title ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  // Category filter
  if (category) {
    whereClauses.push(`p.category = $${paramIdx}`);
    params.push(category);
    paramIdx++;
  }

  // Brand filter
  if (brand) {
    whereClauses.push(`p.brand = $${paramIdx}`);
    params.push(brand);
    paramIdx++;
  }

  // Min price filter
  if (minPrice) {
    whereClauses.push(`p.price >= $${paramIdx}`);
    params.push(parseFloat(minPrice));
    paramIdx++;
  }

  // Max price filter
  if (maxPrice) {
    whereClauses.push(`p.price <= $${paramIdx}`);
    params.push(parseFloat(maxPrice));
    paramIdx++;
  }

  if (whereClauses.length > 0) {
    const whereStr = ` WHERE ` + whereClauses.join(' AND ');
    queryText += whereStr;
    countQueryText += whereStr;
  }

  queryText += ` GROUP BY p.id`;

  // Sorting
  const allowedSortFields = ['price', 'rating', 'created_at', 'title'];
  const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  queryText += ` ORDER BY p.${sortField} ${sortOrder}`;

  // Pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  queryText += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  
  // Create pagination params
  const countParams = [...params];
  params.push(parseInt(limit), offset);

  try {
    const dataPromise = db.query(queryText, params);
    const countPromise = db.query(countQueryText, countParams);

    const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);
    
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    res.json({
      products: dataResult.rows,
      pagination: {
        totalItems,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// 2. Get all categories
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != \'\''
    );
    const categories = result.rows.map(row => row.category);
    res.json(categories);
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// 8. GET /api/products/recently-viewed - Retrieve user's recently viewed history (last 20 unique products)
router.get('/recently-viewed', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT rv.viewed_at, p.*,
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
       FROM recently_viewed rv
       JOIN products p ON rv.product_id = p.id
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE rv.user_id = $1
       GROUP BY rv.id, p.id
       ORDER BY rv.viewed_at DESC
       LIMIT 20`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch recently viewed error:', error);
    res.status(500).json({ error: 'Failed to fetch recently viewed products.' });
  }
});

// 3. Get single product detail (with image gallery and reviews)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const productResult = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = productResult.rows[0];

    // Fetch images
    const imagesResult = await db.query(
      'SELECT id, image_url, public_id FROM product_images WHERE product_id = $1',
      [id]
    );
    product.images = imagesResult.rows;

    // Fetch reviews
    const reviewsResult = await db.query(
      `SELECT r.*, u.name as user_name 
       FROM reviews r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.product_id = $1 
       ORDER BY r.created_at DESC`,
      [id]
    );
    product.reviews = reviewsResult.rows;

    res.json(product);
  } catch (error) {
    console.error('Fetch single product error:', error);
    res.status(500).json({ error: 'Failed to fetch product details.' });
  }
});

// 4. Create Product (Admin only, upload multiple files to Cloudinary)
router.post('/', verifyToken, verifyAdmin, upload.array('images', 5), async (req, res) => {
  const { title, description, category, brand, price, discount, stock } = req.body;

  if (!title || !price || stock === undefined) {
    return res.status(400).json({ error: 'Title, price, and stock are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Insert product
    const productResult = await client.query(
      `INSERT INTO products (title, description, category, brand, price, discount, rating, stock)
       VALUES ($1, $2, $3, $4, $5, $6, 0.00, $7) RETURNING *`,
      [title, description, category, brand, parseFloat(price), parseFloat(discount || 0), parseInt(stock)]
    );
    const newProduct = productResult.rows[0];

    // Uploaded files metadata from multer-storage-cloudinary
    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageResult = await client.query(
          `INSERT INTO product_images (product_id, image_url, public_id)
           VALUES ($1, $2, $3) RETURNING *`,
          [newProduct.id, file.path, file.filename]
        );
        images.push(imageResult.rows[0]);
      }
    }

    await client.query('COMMIT');
    newProduct.images = images;
    res.status(201).json({ message: 'Product created successfully.', product: newProduct });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product.' });
  } finally {
    client.release();
  }
});

// 5. Update Product (Admin only)
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, description, category, brand, price, discount, stock } = req.body;

  if (!title || !price || stock === undefined) {
    return res.status(400).json({ error: 'Title, price, and stock are required.' });
  }

  try {
    const result = await db.query(
      `UPDATE products 
       SET title = $1, description = $2, category = $3, brand = $4, price = $5, discount = $6, stock = $7
       WHERE id = $8 RETURNING *`,
      [title, description, category, brand, parseFloat(price), parseFloat(discount || 0), parseInt(stock), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json({ message: 'Product updated successfully.', product: result.rows[0] });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// 6. Delete Product (Admin only, deletes associated Cloudinary assets)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    // Fetch images to delete from Cloudinary
    const imagesResult = await client.query(
      'SELECT public_id FROM product_images WHERE product_id = $1',
      [id]
    );

    // Delete files from Cloudinary
    for (const img of imagesResult.rows) {
      if (img.public_id) {
        await cloudinary.uploader.destroy(img.public_id);
      }
    }

    // Delete product (will cascade delete product_images due to foreign key constraint)
    const deleteResult = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found.' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Product and associated images deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product.' });
  } finally {
    client.release();
  }
});

// 7. POST /api/products/:id/view - Log a product view in user's recently viewed history
router.post('/:id/view', verifyToken, async (req, res) => {
  const { id } = req.params;
  const productId = parseInt(id);
  const userId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verify product exists
    const prodRes = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Upsert into recently_viewed to avoid duplicates and update timestamp
    await client.query(
      `INSERT INTO recently_viewed (user_id, product_id, viewed_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, product_id) 
       DO UPDATE SET viewed_at = EXCLUDED.viewed_at`,
      [userId, productId]
    );

    // Limit history to latest 20 products for this user
    await client.query(
      `DELETE FROM recently_viewed 
       WHERE user_id = $1 
         AND id NOT IN (
           SELECT id FROM recently_viewed 
           WHERE user_id = $1 
           ORDER BY viewed_at DESC 
           LIMIT 20
         )`,
      [userId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'View recorded.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Record product view error:', error);
    res.status(500).json({ error: 'Failed to record product view.' });
  } finally {
    client.release();
  }
});



module.exports = router;
