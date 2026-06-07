const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { sendShippingEmail, sendDeliveryEmail } = require('../utils/email.util');
const { generateInvoicePDF } = require('../utils/invoice.util');

// 1. GET /api/orders - Fetch customer's own order history, or ALL orders if Admin
router.get('/', verifyToken, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await db.query(
        `SELECT o.*, u.name as user_name, u.email as user_email
         FROM orders o
         JOIN users u ON o.user_id = u.id
         ORDER BY o.created_at DESC`
      );
    } else {
      result = await db.query(
        `SELECT * FROM orders 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// 2. GET /api/orders/:id - Fetch single order details with items
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    let orderRes;
    if (req.user.role === 'admin') {
      orderRes = await db.query(
        `SELECT o.*, u.name as user_name, u.email as user_email
         FROM orders o
         JOIN users u ON o.user_id = u.id
         WHERE o.id = $1`,
        [id]
      );
    } else {
      orderRes = await db.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );
    }

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRes.rows[0];

    // Fetch items
    const itemsRes = await db.query(
      `SELECT oi.*, COALESCE(p.title, 'Deleted Product') as title, 
              COALESCE((SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1), p.thumbnail) as thumbnail
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [id]
    );
    order.items = itemsRes.rows;

    // Fetch address snapshot
    const addressRes = await db.query(
      'SELECT * FROM order_addresses WHERE order_id = $1',
      [id]
    );
    order.address = addressRes.rows[0] || null;

    res.json(order);
  } catch (error) {
    console.error('Fetch order details error:', error);
    res.status(500).json({ error: 'Failed to fetch order details.' });
  }
});

// 3. GET /api/orders/:id/tracking - Fetch order tracking timeline & logs
router.get('/:id/tracking', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Verify ownership
    let orderRes;
    if (req.user.role === 'admin') {
      orderRes = await db.query('SELECT id FROM orders WHERE id = $1', [id]);
    } else {
      orderRes = await db.query('SELECT id FROM orders WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    }

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const trackingRes = await db.query(
      'SELECT * FROM order_tracking WHERE order_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json(trackingRes.rows);
  } catch (error) {
    console.error('Fetch tracking error:', error);
    res.status(500).json({ error: 'Failed to fetch tracking history.' });
  }
});

// 4. PUT /api/orders/:id/status - Update order status (Admin only)
router.put('/:id/status', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, message } = req.body;

  const validStatuses = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update order status
    const orderRes = await client.query(
      'UPDATE orders SET order_status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }

    const updatedOrder = orderRes.rows[0];

    // 2. Insert order tracking log
    const trackingMsg = message || `Order status updated to ${status}.`;
    await client.query(
      'INSERT INTO order_tracking (order_id, status, message) VALUES ($1, $2, $3)',
      [id, status, trackingMsg]
    );

    await client.query('COMMIT');

    // 3. Fire Transactional Emails asynchronously
    const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [updatedOrder.user_id]);
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      if (status === 'Shipped') {
        sendShippingEmail(user, updatedOrder).catch(err => console.error('Failed to send shipping email:', err));
      } else if (status === 'Delivered') {
        sendDeliveryEmail(user, updatedOrder).catch(err => console.error('Failed to send delivery email:', err));
      }
    }

    res.json({ message: 'Order status updated successfully.', order: updatedOrder });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status.' });
  } finally {
    client.release();
  }
});

// 5. GET /api/orders/:id/invoice - Generate downloadable order invoice PDF
router.get('/:id/invoice', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Fetch Order from DB
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRes.rows[0];

    // Verify ownership
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to download this invoice.' });
    }

    // 2. Generate persistent Invoice Number if missing
    if (!order.invoice_number) {
      const today = new Date();
      const dateStr = today.getFullYear().toString() +
                      (today.getMonth() + 1).toString().padStart(2, '0') +
                      today.getDate().toString().padStart(2, '0');
      
      const invoiceNumber = `INV-${dateStr}-${order.id}`;
      const generatedAt = new Date();

      await db.query(
        'UPDATE orders SET invoice_number = $1, invoice_generated_at = $2 WHERE id = $3',
        [invoiceNumber, generatedAt, order.id]
      );

      order.invoice_number = invoiceNumber;
      order.invoice_generated_at = generatedAt;
    }

    // 3. Fetch Items associated with order
    const itemsRes = await db.query(
      `SELECT oi.*, p.title, p.thumbnail 
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    // 4. Fetch Shipping Address snapshot
    const addressRes = await db.query(
      'SELECT * FROM order_addresses WHERE order_id = $1',
      [order.id]
    );

    // 5. Set PDF Response Headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.id}.pdf`);

    // 6. Pipe invoice generation stream directly to response
    generateInvoicePDF(
      order,
      itemsRes.rows,
      addressRes.rows[0] || null,
      req.user,
      res
    );

  } catch (error) {
    console.error('Invoice generation failed:', error);
    res.status(500).json({ error: 'Failed to generate invoice PDF.' });
  }
});

// 6. POST /api/orders/:id/tracking - Add custom tracking log (Admin only)
router.post('/:id/tracking', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, location, message, triggerEmail } = req.body;
  if (!status || !location || !message) {
    return res.status(400).json({ error: 'Status, location, and message are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert order tracking log
    const result = await client.query(
      'INSERT INTO order_tracking (order_id, status, location, message) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, status, location, message]
    );

    // 2. Update parent order status
    await client.query(
      'UPDATE orders SET order_status = $1 WHERE id = $2',
      [status, id]
    );

    // 3. Create notification for user
    const orderRes = await client.query('SELECT user_id, estimated_delivery_date FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderRes.rows[0];
    
    const notifIcons = {
      'Placed': '🛍️',
      'Packed': '📦',
      'Shipped': '🚚',
      'Out For Delivery': '📍',
      'Delivered': '✅',
      'Refunded': '💰'
    };
    const title = `${notifIcons[status] || '🚚'} Order ${status}`;
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
      [order.user_id, title, message, status]
    );

    await client.query('COMMIT');

    // 4. Optionally trigger email
    if (triggerEmail) {
      const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [order.user_id]);
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        const emailUtil = require('../utils/email.util');
        
        switch (status) {
          case 'Placed':
            const itemsRes = await db.query(
              `SELECT oi.*, p.title, p.thumbnail 
               FROM order_items oi
               LEFT JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = $1`,
              [id]
            );
            const addressRes = await db.query('SELECT * FROM order_addresses WHERE order_id = $1', [id]);
            await emailUtil.sendOrderConfirmationEmail(user, order, itemsRes.rows, addressRes.rows[0] || null);
            break;
          case 'Packed':
            await emailUtil.sendPackedEmail(user, order, location);
            break;
          case 'Shipped':
            await emailUtil.sendShippingEmail(user, order, location);
            break;
          case 'Out For Delivery':
            await emailUtil.sendOutForDeliveryEmail(user, order, location, null);
            break;
          case 'Delivered':
            await emailUtil.sendDeliveryEmail(user, order, location, null);
            break;
          case 'Refunded':
            await emailUtil.sendRefundEmail(user, order);
            break;
        }
      }
    }

    res.status(201).json({ message: 'Tracking log added successfully.', log: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add tracking log error:', error);
    res.status(500).json({ error: 'Failed to add tracking log.' });
  } finally {
    client.release();
  }
});

// 7. POST /api/orders/:id/resend-email - Resend tracking email (Admin only)
router.post('/:id/resend-email', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['Placed', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered', 'Refunded'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid tracking status for email resend.' });
  }
  try {
    // Fetch order and customer details
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderRes.rows[0];
    const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [order.user_id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = userRes.rows[0];
    
    // Fetch latest tracking log for this status to get location info
    const trackingRes = await db.query(
      'SELECT location FROM order_tracking WHERE order_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [id, status]
    );
    const location = trackingRes.rows[0]?.location || 'Mumbai Warehouse';

    const emailUtil = require('../utils/email.util');
    
    switch (status) {
      case 'Placed':
        // Fetch order items and address for order confirmation email
        const itemsRes = await db.query(
          `SELECT oi.*, p.title, p.thumbnail 
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [id]
        );
        const addressRes = await db.query('SELECT * FROM order_addresses WHERE order_id = $1', [id]);
        await emailUtil.sendOrderConfirmationEmail(user, order, itemsRes.rows, addressRes.rows[0] || null);
        break;
      case 'Packed':
        await emailUtil.sendPackedEmail(user, order, location);
        break;
      case 'Shipped':
        await emailUtil.sendShippingEmail(user, order, location);
        break;
      case 'Out For Delivery':
        await emailUtil.sendOutForDeliveryEmail(user, order, location, null);
        break;
      case 'Delivered':
        await emailUtil.sendDeliveryEmail(user, order, location, null);
        break;
      case 'Refunded':
        await emailUtil.sendRefundEmail(user, order);
        break;
      default:
        return res.status(400).json({ error: 'No email template mapped for this status.' });
    }
    
    res.json({ message: `Successfully resent ${status} email to ${user.email}.` });
  } catch (error) {
    console.error('Resend email error:', error);
    res.status(500).json({ error: 'Failed to resend tracking email.' });
  }
});

module.exports = router;

