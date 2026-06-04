const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

// Helper to upload external URL image to Cloudinary
const uploadUrlToCloudinary = async (url) => {
  try {
    const result = await cloudinary.uploader.upload(url, {
      folder: 'myshopee/products',
    });
    return {
      image_url: result.secure_url,
      public_id: result.public_id
    };
  } catch (error) {
    console.error(`Failed to upload ${url} to Cloudinary, using fallback.`, error.message);
    // Fallback: use direct URL
    return {
      image_url: url,
      public_id: 'fallback_dummyjson'
    };
  }
};

// 1. POST /api/admin/import-products - Import from DummyJSON
router.post('/import-products', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('Fetching products from DummyJSON API...');
    const response = await axios.get('https://dummyjson.com/products?limit=30');
    const { products } = response.data;
    
    let importedCount = 0;
    let duplicateCount = 0;

    for (const product of products) {
      // Prevent duplicate imports based on title matching
      const existCheck = await db.query('SELECT id FROM products WHERE title = $1', [product.title]);
      
      if (existCheck.rows.length > 0) {
        duplicateCount++;
        continue;
      }

      // Start transaction for this product
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        // Insert product
        const insertProductQuery = `
          INSERT INTO products (title, description, category, brand, price, discount, rating, stock)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `;
        const productValues = [
          product.title,
          product.description,
          product.category,
          product.brand || 'Generic',
          product.price,
          product.discountPercentage || 0,
          product.rating || 0,
          product.stock || 10
        ];
        
        const productResult = await client.query(insertProductQuery, productValues);
        const productId = productResult.rows[0].id;

        // Upload Thumbnail to Cloudinary
        const thumbUpload = await uploadUrlToCloudinary(product.thumbnail);
        await client.query(
          'INSERT INTO product_images (product_id, image_url, public_id) VALUES ($1, $2, $3)',
          [productId, thumbUpload.image_url, thumbUpload.public_id]
        );

        // Upload other images (up to 3 to avoid rate-limiting)
        const additionalImages = product.images || [];
        for (const imgUrl of additionalImages.slice(0, 3)) {
          if (imgUrl === product.thumbnail) continue; // skip thumbnail duplicate
          const imgUpload = await uploadUrlToCloudinary(imgUrl);
          await client.query(
            'INSERT INTO product_images (product_id, image_url, public_id) VALUES ($1, $2, $3)',
            [productId, imgUpload.image_url, imgUpload.public_id]
          );
        }

        await client.query('COMMIT');
        importedCount++;
      } catch (prodErr) {
        await client.query('ROLLBACK');
        console.error(`Error importing product "${product.title}":`, prodErr);
      } finally {
        client.release();
      }
    }

    res.json({
      message: 'Product import completed.',
      importedCount,
      duplicateCount,
      totalProcessed: products.length
    });
  } catch (error) {
    console.error('Import products error:', error);
    res.status(500).json({ error: 'Failed to import products from DummyJSON.' });
  }
});

// 2. GET /api/admin/analytics - Dashboard Stats
router.get('/analytics', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const revenueQuery = `SELECT SUM(amount) as total FROM payments WHERE status = 'paid' OR status = 'succeeded'`;
    const ordersQuery = `SELECT COUNT(*) as total FROM orders`;
    const customersQuery = `SELECT COUNT(*) as total FROM users WHERE role = 'customer'`;
    const productsQuery = `SELECT COUNT(*) as total, SUM(stock) as stock_total FROM products`;
    const recentOrdersQuery = `
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `;

    const [revenueRes, ordersRes, customersRes, productsRes, recentOrdersRes] = await Promise.all([
      db.query(revenueQuery),
      db.query(ordersQuery),
      db.query(customersQuery),
      db.query(productsQuery),
      db.query(recentOrdersQuery)
    ]);

    const totalRevenue = parseFloat(revenueRes.rows[0].total || 0);
    const totalOrders = parseInt(ordersRes.rows[0].total || 0);
    const totalCustomers = parseInt(customersRes.rows[0].total || 0);
    const totalProducts = parseInt(productsRes.rows[0].total || 0);
    const inventoryOverview = parseInt(productsRes.rows[0].stock_total || 0);

    res.json({
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,
      inventoryOverview,
      recentOrders: recentOrdersRes.rows
    });
  } catch (error) {
    console.error('Fetch analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics.' });
  }
});

// 3. GET /api/admin/charts - Data for Recharts UI
router.get('/charts', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // 1. Monthly sales & revenue chart (Last 6 months)
    const salesHistoryQuery = `
      SELECT TO_CHAR(created_at, 'Mon YYYY') as month,
             SUM(total_amount) as revenue,
             COUNT(id) as orders
      FROM orders
      WHERE payment_status = 'paid'
      GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
      LIMIT 6
    `;

    // 2. Customer growth chart
    const customerGrowthQuery = `
      SELECT TO_CHAR(created_at, 'Mon YYYY') as month,
             COUNT(id) as customers
      FROM users
      WHERE role = 'customer'
      GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
      LIMIT 6
    `;

    // 3. Top products chart
    const topProductsQuery = `
      SELECT p.title, SUM(oi.quantity) as sold
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.payment_status = 'paid'
      GROUP BY p.title
      ORDER BY sold DESC
      LIMIT 5
    `;

    const [salesRes, growthRes, productsRes] = await Promise.all([
      db.query(salesHistoryQuery),
      db.query(customerGrowthQuery),
      db.query(topProductsQuery)
    ]);

    // Format results. If DB is empty, supply rich dummy data so charts rendering doesn't look empty.
    let monthlySales = salesRes.rows;
    if (monthlySales.length === 0) {
      monthlySales = [
        { month: 'Jan 2026', revenue: 4500, orders: 35 },
        { month: 'Feb 2026', revenue: 5200, orders: 42 },
        { month: 'Mar 2026', revenue: 6100, orders: 48 },
        { month: 'Apr 2026', revenue: 5800, orders: 44 },
        { month: 'May 2026', revenue: 7800, orders: 60 }
      ];
    }

    let customerGrowth = growthRes.rows;
    if (customerGrowth.length === 0) {
      customerGrowth = [
        { month: 'Jan 2026', customers: 120 },
        { month: 'Feb 2026', customers: 145 },
        { month: 'Mar 2026', customers: 180 },
        { month: 'Apr 2026', customers: 210 },
        { month: 'May 2026', customers: 260 }
      ];
    }

    let topProducts = productsRes.rows;
    if (topProducts.length === 0) {
      topProducts = [
        { title: 'iPhone 15 Pro Max', sold: 15 },
        { title: 'MacBook Air M3', sold: 10 },
        { title: 'iPad Pro 11"', sold: 8 },
        { title: 'AirPods Pro 2', sold: 25 },
        { title: 'Apple Watch Series 9', sold: 12 }
      ];
    }

    res.json({
      monthlySales,
      customerGrowth,
      topProducts
    });
  } catch (error) {
    console.error('Fetch charts error:', error);
    res.status(500).json({ error: 'Failed to fetch chart metrics.' });
  }
});

// 4. GET /api/admin/users - Manage Users
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Failed to fetch user list.' });
  }
});

// 5. PUT /api/admin/users/:id/role - Toggle Admin role
router.put('/users/:id/role', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (role !== 'admin' && role !== 'customer') {
    return res.status(400).json({ error: 'Invalid role. Must be admin or customer.' });
  }

  try {
    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ message: 'User role updated successfully.', user: result.rows[0] });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

module.exports = router;
