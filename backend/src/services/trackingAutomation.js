const db = require('../db');
const emailUtil = require('../utils/email.util');
const { getSystemSettings } = require('../utils/settings.util');

const orderStages = ['Placed', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered'];

// Tracking text details for status logs
const trackingInfo = {
  'Packed': { location: 'Mumbai Warehouse', message: 'Your items have been packed and are ready for shipment.' },
  'Shipped': { location: 'Mumbai Dispatch Center', message: 'Your package has been handed over to our courier partner.' },
  'Out For Delivery': { location: 'Local Delivery Center', message: 'Your package is out for delivery and should arrive today.' },
  'Delivered': { location: 'Customer Address', message: 'Your package has been delivered successfully.' }
};

// Send emails depending on the advanced status
const sendStatusEmail = async (user, order, status, info) => {
  switch (status) {
    case 'Packed':
      await emailUtil.sendPackedEmail(user, order, info.location);
      break;
    case 'Shipped':
      await emailUtil.sendShippingEmail(user, order, info.location);
      break;
    case 'Out For Delivery':
      await emailUtil.sendOutForDeliveryEmail(user, order, info.location, null);
      break;
    case 'Delivered':
      await emailUtil.sendDeliveryEmail(user, order, info.location, null);
      break;
    default:
      console.warn(`No notification email mapped for status: ${status}`);
  }
};

const advanceOrderStatus = async (order, nextStatus) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update order status
    await client.query(
      'UPDATE orders SET order_status = $1 WHERE id = $2',
      [nextStatus, order.id]
    );

    // 2. Insert tracking log
    const info = trackingInfo[nextStatus];
    await client.query(
      'INSERT INTO order_tracking (order_id, status, location, message) VALUES ($1, $2, $3, $4)',
      [order.id, nextStatus, info.location, info.message]
    );

    // Create database notification
    const notifIcons = {
      'Packed': '📦',
      'Shipped': '🚚',
      'Out For Delivery': '📍',
      'Delivered': '✅'
    };
    const title = `${notifIcons[nextStatus] || '🚚'} Order ${nextStatus}`;
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type) 
       VALUES ($1, $2, $3, $4)`,
      [order.user_id, title, info.message, nextStatus]
    );

    await client.query('COMMIT');
    console.log(`🚚 [AUTOMATION] Order #${order.id} transitioned to "${nextStatus}"`);

    // 3. Fetch customer details and send status email
    const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [order.user_id]);
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const freshOrderRes = await db.query('SELECT * FROM orders WHERE id = $1', [order.id]);
      if (freshOrderRes.rows.length > 0) {
        sendStatusEmail(user, freshOrderRes.rows[0], nextStatus, info).catch(err => {
          console.error(`Failed to send automated email for order #${order.id} status ${nextStatus}:`, err);
        });
      }
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error advancing order #${order.id} to ${nextStatus}:`, error);
  } finally {
    client.release();
  }
};

const processTrackingUpdates = async () => {
  try {
    // 1. Fetch active orders (non-Delivered, non-Refunded, non-Cancelled)
    const activeOrdersRes = await db.query(
      `SELECT * FROM orders 
       WHERE order_status NOT IN ('Delivered', 'Refunded', 'Cancelled') 
       ORDER BY id ASC`
    );

    const now = new Date();
    const settings = await getSystemSettings();
    const isFastTracking = settings.isFastTracking;
    const isProduction = settings.isProduction;

    for (const order of activeOrdersRes.rows) {
      // Calculate estimated delivery date fallback if missing
      let estDelivery = order.estimated_delivery_date;
      const orderCreated = new Date(order.created_at);

      if (!estDelivery) {
        estDelivery = new Date(orderCreated.getTime());
        if (isFastTracking) {
          estDelivery.setSeconds(estDelivery.getSeconds() + 40);
        } else if (isProduction) {
          estDelivery.setDate(estDelivery.getDate() + 4);
        } else {
          estDelivery.setSeconds(estDelivery.getSeconds() + 120);
        }
      } else {
        estDelivery = new Date(estDelivery);
      }

      const totalDuration = estDelivery.getTime() - orderCreated.getTime();
      const elapsed = now.getTime() - orderCreated.getTime();
      
      // Calculate progress percentage
      const progress = totalDuration <= 0 ? 1.0 : Math.min(1.0, elapsed / totalDuration);

      // Determine target status based on elapsed percentage (25%, 50%, 75%/90%, 100%)
      let targetStatus = 'Placed';
      if (progress >= 1.0) {
        targetStatus = 'Delivered';
      } else if (progress >= (isProduction ? 0.90 : 0.75)) {
        targetStatus = 'Out For Delivery';
      } else if (progress >= 0.50) {
        targetStatus = 'Shipped';
      } else if (progress >= 0.25) {
        targetStatus = 'Packed';
      }

      const currentStatusIdx = orderStages.indexOf(order.order_status);
      const targetStatusIdx = orderStages.indexOf(targetStatus);

      // Advance one step at a time to generate clean logs and sequential emails
      if (targetStatusIdx > currentStatusIdx) {
        const nextStatus = orderStages[currentStatusIdx + 1];
        await advanceOrderStatus(order, nextStatus);
      }
    }
  } catch (error) {
    console.error('Error processing automated tracking schedules:', error);
  }
};

const processReviewReminders = async () => {
  try {
    // 1. Fetch delivered orders
    const deliveredOrdersRes = await db.query(
      `SELECT * FROM orders WHERE order_status = 'Delivered'`
    );

    const now = new Date();
    const settings = await getSystemSettings();
    const isFastTracking = settings.isFastTracking;
    
    // Threshold to wait after delivery
    const reminderDelayMs = isFastTracking 
      ? 10 * 1000 // 10 seconds for demo
      : 24 * 60 * 60 * 1000; // 24 hours for production/dev-normal

    for (const order of deliveredOrdersRes.rows) {
      const deliveryTarget = order.estimated_delivery_date 
        ? new Date(order.estimated_delivery_date) 
        : new Date(order.created_at); // fallback

      // Check if reminder threshold has passed since estimated delivery
      if (now.getTime() - deliveryTarget.getTime() >= reminderDelayMs) {
        
        // Check if reminder was already sent
        const logCheck = await db.query(
          `SELECT id FROM notification_logs 
           WHERE order_id = $1 AND type = 'review_reminder_email'`,
          [order.id]
        );

        if (logCheck.rows.length === 0) {
          // Send reminder
          const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [order.user_id]);
          if (userRes.rows.length > 0) {
            const user = userRes.rows[0];
            await emailUtil.sendReviewReminderEmail(user, order);
            console.log(`📧 [AUTOMATION] Review reminder sent for order #${order.id}`);

            // Create database notification for review incentive
            await db.query(
              `INSERT INTO notifications (user_id, title, message, type) 
               VALUES ($1, $2, $3, $4)`,
              [order.user_id, '⭐ Leave a Review', `How was your purchase for Order #${order.id}? Leave a review to help others!`, 'ReviewReminder']
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing review reminder emails:', error);
  }
};

const returnStages = [
  'Return Requested',
  'Under Review',
  'Approved',
  'Pickup Scheduled',
  'Item Received',
  'Refund Processing',
  'Refunded'
];

const defaultReturnTrackingDetails = {
  'Return Requested': { location: 'Online Portal', message: 'Customer submitted return request.' },
  'Under Review': { location: 'Return Processing Center', message: 'Return team reviewing request.' },
  'Approved': { location: 'Support Team', message: 'Return approved by support team.' },
  'Pickup Scheduled': { location: 'Courier Logistics', message: 'Pickup scheduled for tomorrow.' },
  'Item Received': { location: 'Warehouse Hub', message: 'Returned item received at warehouse.' },
  'Refund Processing': { location: 'Billing Department', message: 'Refund initiated through Stripe.' },
  'Refunded': { location: 'Customer Account', message: 'Amount credited successfully.' }
};

const advanceReturnStatus = async (returnRequest, nextStatus) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update return status
    await client.query(
      'UPDATE returns SET status = $1 WHERE id = $2',
      [nextStatus, returnRequest.id]
    );

    // 2. Insert return tracking log
    const info = defaultReturnTrackingDetails[nextStatus];
    await client.query(
      `INSERT INTO return_tracking (return_id, status, location, message) 
       VALUES ($1, $2, $3, $4)`,
      [returnRequest.id, nextStatus, info.location, info.message]
    );

    // 3. Create database notification depending on status
    const notifTitle = {
      'Approved': '✅ Return Approved',
      'Pickup Scheduled': '🚚 Pickup Scheduled',
      'Item Received': '📦 Return Item Received',
      'Refund Processing': '💸 Refund Processing',
      'Refunded': '💰 Refund Processed'
    };

    if (notifTitle[nextStatus]) {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type) 
         VALUES ($1, $2, $3, $4)`,
        [returnRequest.user_id, notifTitle[nextStatus], info.message, nextStatus]
      );
    }

    // 4. Additional actions if transition to "Refunded"
    let stripeRefundSuccess = false;
    let stripeError = null;

    if (nextStatus === 'Refunded') {
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

      // Retrieve Stripe Payment Intent ID from order
      const orderRes = await client.query('SELECT stripe_payment_intent_id FROM orders WHERE id = $1', [returnRequest.order_id]);
      if (orderRes.rows.length > 0) {
        const intentId = orderRes.rows[0].stripe_payment_intent_id;
        if (intentId) {
          const isPlaceholderKey = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_placeholder');
          if (!isPlaceholderKey) {
            try {
              const stripeInstance = require('stripe')(process.env.STRIPE_SECRET_KEY);
              await stripeInstance.refunds.create({
                payment_intent: intentId
              });
              stripeRefundSuccess = true;
            } catch (err) {
              stripeError = err.message;
              console.error(`❌ [STRIPE AUTOMATION] Refund request failed for ${intentId}:`, err.message);
            }
          } else {
            console.log(`💡 [STRIPE AUTOMATION] Simulated refund successfully processed for PaymentIntent: ${intentId}`);
            stripeRefundSuccess = true;
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`↩️ [AUTOMATION] Return Request #${returnRequest.id} transitioned to "${nextStatus}"`);

    // 5. Fetch user and order details to send transactional emails asynchronously
    const userRes = await db.query('SELECT name, email, id FROM users WHERE id = $1', [returnRequest.user_id]);
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [returnRequest.order_id]);

    if (userRes.rows.length > 0) {
      const userData = userRes.rows[0];
      const freshReturnRes = await db.query('SELECT * FROM returns WHERE id = $1', [returnRequest.id]);
      const updatedReturnRequest = freshReturnRes.rows[0];

      if (nextStatus === 'Approved') {
        emailUtil.sendReturnApprovedEmail(userData, updatedReturnRequest).catch(err => {
          console.error('Failed to send Return Approved email via automation:', err);
        });
      } else if (nextStatus === 'Pickup Scheduled') {
        emailUtil.sendPickupScheduledEmail(userData, updatedReturnRequest).catch(err => {
          console.error('Failed to send Pickup Scheduled email via automation:', err);
        });
      } else if (nextStatus === 'Refund Processing') {
        emailUtil.sendRefundProcessingEmail(userData, updatedReturnRequest).catch(err => {
          console.error('Failed to send Refund Processing email via automation:', err);
        });
      } else if (nextStatus === 'Refunded' && orderRes.rows.length > 0) {
        emailUtil.sendRefundCompletedEmail(userData, orderRes.rows[0]).catch(err => {
          console.error('Failed to send Refund Completed email via automation:', err);
        });
      }
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error advancing Return Request #${returnRequest.id} to ${nextStatus}:`, error);
  } finally {
    client.release();
  }
};

const processReturnUpdates = async () => {
  try {
    // Fetch active return requests (not in 'Refunded' or 'Rejected')
    const activeReturnsRes = await db.query(
      `SELECT * FROM returns 
       WHERE status NOT IN ('Refunded', 'Rejected') 
       ORDER BY id ASC`
    );

    const now = new Date();
    const settings = await getSystemSettings();
    const isFastTracking = settings.isFastTracking;
    const isProduction = settings.isProduction;

    for (const ret of activeReturnsRes.rows) {
      const returnCreated = new Date(ret.created_at);
      
      const totalDuration = isFastTracking 
        ? 60 * 1000 // 60 seconds
        : (isProduction ? 6 * 24 * 60 * 60 * 1000 : 120 * 1000); // 6 days in prod, 120s in dev-normal

      const elapsed = now.getTime() - returnCreated.getTime();
      const progress = totalDuration <= 0 ? 1.0 : Math.min(1.0, elapsed / totalDuration);

      let targetStatus = 'Return Requested';
      if (progress >= 1.0) {
        targetStatus = 'Refunded';
      } else if (progress >= 5/6) {
        targetStatus = 'Refund Processing';
      } else if (progress >= 4/6) {
        targetStatus = 'Item Received';
      } else if (progress >= 3/6) {
        targetStatus = 'Pickup Scheduled';
      } else if (progress >= 2/6) {
        targetStatus = 'Approved';
      } else if (progress >= 1/6) {
        targetStatus = 'Under Review';
      }

      const currentStatusIdx = returnStages.indexOf(ret.status);
      const targetStatusIdx = returnStages.indexOf(targetStatus);

      // Advance one step at a time
      if (targetStatusIdx > currentStatusIdx) {
        const nextStatus = returnStages[currentStatusIdx + 1];
        await advanceReturnStatus(ret, nextStatus);
      }
    }
  } catch (error) {
    console.error('Error processing automated return schedules:', error);
  }
};

let intervalId = null;

const start = () => {
  console.log('⏰ Starting Automated Order Tracking & Review Reminder Scheduled Worker...');
  // Run loop every 8 seconds
  intervalId = setInterval(async () => {
    await processTrackingUpdates();
    await processReturnUpdates();
    await processReviewReminders();
  }, 8000);
};

const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏰ Stopped Automated Order Tracking scheduled worker.');
  }
};

module.exports = {
  start,
  stop
};
