const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const emailUtil = require('../utils/email.util');

// 1. POST /api/returns - Submit return request for a delivered order
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  const { orderId, reason, description } = req.body;
  const userId = req.user.id;

  const parsedOrderId = parseInt(orderId);
  if (!parsedOrderId || !reason) {
    return res.status(400).json({ error: 'Order ID and return reason are required.' });
  }

  const imageUrl = req.file ? req.file.path : null;

  try {
    // 1. Check order ownership & status
    const orderRes = await db.query(
      'SELECT id, order_status, user_id, created_at FROM orders WHERE id = $1',
      [parsedOrderId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRes.rows[0];
    if (order.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized return request.' });
    }

    if (order.order_status !== 'Delivered') {
      return res.status(400).json({ error: 'Only delivered orders are eligible for returns.' });
    }

    // 2. Verify return window (7 days from delivery date in order_tracking)
    const trackingRes = await db.query(
      `SELECT created_at FROM order_tracking 
       WHERE order_id = $1 AND status = 'Delivered' 
       ORDER BY created_at DESC LIMIT 1`,
      [parsedOrderId]
    );

    let deliveryDate = order.created_at; // fallback
    if (trackingRes.rows.length > 0) {
      deliveryDate = trackingRes.rows[0].created_at;
    }

    const elapsedMs = new Date().getTime() - new Date(deliveryDate).getTime();
    
    const { getSystemSettings } = require('../utils/settings.util');
    const settings = await getSystemSettings();
    const isFastTracking = settings.isFastTracking;

    // In demo mode: return window closes after 2 minutes (120 seconds) of delivery
    // In production mode: return window closes after 7 days
    const windowLimitMs = isFastTracking 
      ? 120 * 1000 
      : 7 * 24 * 60 * 60 * 1000;

    if (elapsedMs > windowLimitMs) {
      return res.status(400).json({ 
        error: `Return window has closed. Returns are only allowed within ${isFastTracking ? '120 seconds' : '7 days'} of delivery.` 
      });
    }

    const { orderItemId } = req.body;

    // 3. Check if return request already exists
    let duplicateRes;
    if (orderItemId) {
      duplicateRes = await db.query(
        'SELECT id FROM returns WHERE order_id = $1 AND order_item_id = $2',
        [parsedOrderId, orderItemId]
      );
    } else {
      duplicateRes = await db.query(
        'SELECT id FROM returns WHERE order_id = $1 AND order_item_id IS NULL',
        [parsedOrderId]
      );
    }

    if (duplicateRes.rows.length > 0) {
      return res.status(400).json({ error: 'A return request has already been submitted for this item/order.' });
    }

    // 4. Create return request entry
    const insertRes = await db.query(
      `INSERT INTO returns (order_id, user_id, reason, description, image_url, status, order_item_id) 
       VALUES ($1, $2, $3, $4, $5, 'Return Requested', $6) RETURNING *`,
      [parsedOrderId, userId, reason, description || '', imageUrl, orderItemId || null]
    );

    const returnRequest = insertRes.rows[0];

    // Create Return Tracking log
    await db.query(
      `INSERT INTO return_tracking (return_id, status, location, message) 
       VALUES ($1, $2, $3, $4)`,
      [returnRequest.id, 'Return Requested', 'Online Portal', 'Customer submitted return request']
    );

    // Create notification
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type) 
       VALUES ($1, $2, $3, $4)`,
      [userId, '📤 Return Requested', `Your return request for Order #${parsedOrderId} has been submitted successfully.`, 'Return Requested']
    );

    // Send email confirmation
    const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length > 0) {
      emailUtil.sendReturnRequestedEmail(userRes.rows[0], returnRequest).catch(err => {
        console.error('Failed to send Return Requested email:', err);
      });
    }

    res.status(201).json({ 
      message: 'Return request submitted successfully.', 
      returnRequest 
    });

  } catch (error) {
    console.error('Submit return error:', error);
    res.status(500).json({ error: 'Failed to submit return request.' });
  }
});

// 2. GET /api/returns - Fetch return claims (Admin lists all, Customer lists own)
router.get('/', verifyToken, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await db.query(
        `SELECT r.*, o.total_amount, u.name as user_name, u.email as user_email
         FROM returns r
         JOIN orders o ON r.order_id = o.id
         JOIN users u ON r.user_id = u.id
         ORDER BY r.created_at DESC`
      );
    } else {
      result = await db.query(
        `SELECT r.*, o.total_amount
         FROM returns r
         JOIN orders o ON r.order_id = o.id
         WHERE r.user_id = $1
         ORDER BY r.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch returns error:', error);
    res.status(500).json({ error: 'Failed to fetch returns history.' });
  }
});

// 3. PUT /api/returns/:id/status - Update return status (Admin only, handles Stripe Refund & Email)
router.put('/:id/status', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, location, message } = req.body;

  const validStatuses = [
    'Return Requested',
    'Under Review',
    'Approved',
    'Pickup Scheduled',
    'Item Received',
    'Refund Processing',
    'Refunded',
    'Rejected'
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid return status.' });
  }

  const defaultTrackingDetails = {
    'Return Requested': { location: 'Online Portal', message: 'Customer submitted return request.' },
    'Under Review': { location: 'Return Processing Center', message: 'Return team reviewing request.' },
    'Approved': { location: 'Support Team', message: 'Return approved by support team.' },
    'Pickup Scheduled': { location: 'Courier Logistics', message: 'Pickup scheduled for tomorrow.' },
    'Item Received': { location: 'Warehouse Hub', message: 'Returned item received at warehouse.' },
    'Refund Processing': { location: 'Billing Department', message: 'Refund initiated through Stripe.' },
    'Refunded': { location: 'Customer Account', message: 'Amount credited successfully.' },
    'Rejected': { location: 'Support Team', message: 'Return request was rejected by support.' }
  };

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get return details
    const returnCheck = await client.query(
      'SELECT * FROM returns WHERE id = $1',
      [id]
    );

    if (returnCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Return request not found.' });
    }

    const returnRequest = returnCheck.rows[0];

    // 2. Update return status
    const updateReturnRes = await client.query(
      'UPDATE returns SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    const updatedReturnRequest = updateReturnRes.rows[0];

    // 3. Insert return tracking log
    const eventLocation = location || defaultTrackingDetails[status].location;
    const eventMessage = message || defaultTrackingDetails[status].message;
    await client.query(
      `INSERT INTO return_tracking (return_id, status, location, message) 
       VALUES ($1, $2, $3, $4)`,
      [id, status, eventLocation, eventMessage]
    );

    // Insert database notification depending on status
    const notifTitle = {
      'Approved': '✅ Return Approved',
      'Pickup Scheduled': '🚚 Pickup Scheduled',
      'Item Received': '📦 Return Item Received',
      'Refund Processing': '💸 Refund Processing',
      'Refunded': '💰 Refund Processed',
      'Rejected': '❌ Return Rejected'
    };

    if (notifTitle[status]) {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type) 
         VALUES ($1, $2, $3, $4)`,
        [returnRequest.user_id, notifTitle[status], eventMessage, status]
      );
    }

    // 4. Fetch user and order details for email notifications
    const userRes = await db.query('SELECT name, email, id FROM users WHERE id = $1', [returnRequest.user_id]);
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [returnRequest.order_id]);
    
    let stripeRefundSuccess = false;
    let stripeError = null;

    // 5. Additional actions if transition to "Refunded"
    if (status === 'Refunded') {
      // Update parent order status to "Refunded"
      await client.query(
        "UPDATE orders SET order_status = 'Refunded' WHERE id = $1",
        [returnRequest.order_id]
      );

      // Log Outbound Refund tracking entry in order_tracking
      await client.query(
        `INSERT INTO order_tracking (order_id, status, location, message) 
         VALUES ($1, 'Refunded', 'Customer Account', 'Your refund has been successfully processed.')`,
        [returnRequest.order_id]
      );

      // Retrieve Stripe Payment Intent ID from order details
      if (orderRes.rows.length > 0) {
        const orderData = orderRes.rows[0];
        const intentId = orderData.stripe_payment_intent_id;
        
        if (intentId) {
          // Only attempt Stripe refund if it is a real key
          const isPlaceholderKey = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_placeholder');
          if (!isPlaceholderKey) {
            try {
              const stripeInstance = require('stripe')(process.env.STRIPE_SECRET_KEY);
              await stripeInstance.refunds.create({
                payment_intent: intentId
              });
              stripeRefundSuccess = true;
              console.log(`✅ [STRIPE] Successfully issued refund for PaymentIntent: ${intentId}`);
            } catch (err) {
              stripeError = err.message;
              console.error(`❌ [STRIPE] Refund request failed for ${intentId}:`, err.message);
            }
          } else {
            console.log(`💡 [STRIPE] Simulated refund successfully processed for PaymentIntent: ${intentId}`);
            stripeRefundSuccess = true;
          }
        }
      }
    }

    await client.query('COMMIT');

    // 6. Send transactional emails asynchronously
    if (userRes.rows.length > 0) {
      const userData = userRes.rows[0];
      
      if (status === 'Approved') {
        emailUtil.sendReturnApprovedEmail(userData, updatedReturnRequest).catch(err => {
          console.error('Failed to send Return Approved email:', err);
        });
      } else if (status === 'Pickup Scheduled') {
        emailUtil.sendPickupScheduledEmail(userData, updatedReturnRequest).catch(err => {
          console.error('Failed to send Pickup Scheduled email:', err);
        });
      } else if (status === 'Refund Processing') {
        emailUtil.sendRefundProcessingEmail(userData, updatedReturnRequest).catch(err => {
          console.error('Failed to send Refund Processing email:', err);
        });
      } else if (status === 'Refunded' && orderRes.rows.length > 0) {
        emailUtil.sendRefundCompletedEmail(userData, orderRes.rows[0]).catch(err => {
          console.error('Failed to send Refund Completed email:', err);
        });
      }
    }

    res.json({ 
      message: `Return status updated to ${status}.`, 
      returnRequest: updatedReturnRequest,
      stripeRefunded: stripeRefundSuccess,
      stripeError
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update return status error:', error);
    res.status(500).json({ error: 'Failed to update return status.' });
  } finally {
    client.release();
  }
});

// 4. GET /api/returns/:id/tracking - Fetch return tracking timeline logs
router.get('/:id/tracking', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Check return request existence and ownership
    const returnRes = await db.query(
      'SELECT user_id FROM returns WHERE id = $1',
      [id]
    );

    if (returnRes.rows.length === 0) {
      return res.status(404).json({ error: 'Return request not found.' });
    }

    if (returnRes.rows[0].user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const result = await db.query(
      `SELECT * FROM return_tracking 
       WHERE return_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetch return tracking error:', error);
    res.status(500).json({ error: 'Failed to fetch return tracking logs.' });
  }
});

module.exports = router;
