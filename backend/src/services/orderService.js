const db = require('../db');

/**
 * Fetch recent orders for a user
 */
const getRecentOrders = async (userId) => {
  try {
    const result = await db.query(
      `SELECT id, total_amount, payment_status, order_status, created_at 
       FROM orders 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching recent orders in chatbot service:', error);
    throw new Error('Failed to load recent orders.');
  }
};

/**
 * Fetch detailed order status and tracking logs
 */
const getOrderStatus = async (orderId, userId) => {
  try {
    // 1. Fetch order details to verify owner
    const orderRes = await db.query(
      `SELECT id, total_amount, payment_status, order_status, created_at, estimated_delivery_date 
       FROM orders 
       WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );

    if (orderRes.rows.length === 0) {
      return null;
    }

    const order = orderRes.rows[0];

    // 2. Fetch tracking details
    const trackingRes = await db.query(
      `SELECT status, location, message, created_at 
       FROM order_tracking 
       WHERE order_id = $1 
       ORDER BY created_at DESC`,
      [orderId]
    );
    order.tracking = trackingRes.rows;

    // 3. Fetch address snapshot
    const addressRes = await db.query(
      `SELECT full_name, phone, address_line_1, address_line_2, landmark, city, state, pincode, country 
       FROM order_addresses 
       WHERE order_id = $1`,
      [orderId]
    );
    order.address = addressRes.rows[0] || null;

    // 4. Fetch ordered items
    const itemsRes = await db.query(
      `SELECT oi.quantity, oi.price, p.title, p.id as product_id
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );
    order.items = itemsRes.rows;

    // 5. Calculate live location and remaining time
    const currentLocation = trackingRes.rows[0]?.location || 'Mumbai Warehouse';
    const estDelivery = order.estimated_delivery_date ? new Date(order.estimated_delivery_date) : null;
    
    let remainingTime = 'Already delivered';
    if (order.order_status !== 'Delivered') {
      if (estDelivery) {
        const now = new Date();
        const diffMs = estDelivery.getTime() - now.getTime();
        if (diffMs > 0) {
          const diffSecs = Math.floor(diffMs / 1000);
          if (diffSecs < 130) {
            remainingTime = `${diffSecs} seconds`;
          } else if (diffSecs < 3600) {
            remainingTime = `${Math.floor(diffSecs / 60)} minutes`;
          } else if (diffSecs < 86400) {
            remainingTime = `${Math.floor(diffSecs / 3600)} hours`;
          } else {
            remainingTime = `${Math.ceil(diffSecs / 86400)} days`;
          }
        } else {
          remainingTime = 'Arriving shortly';
        }
      } else {
        remainingTime = 'Pending estimate';
      }
    }

    order.currentLocation = currentLocation;
    order.estimatedDelivery = estDelivery 
      ? estDelivery.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Pending Estimate';
    order.remainingTime = remainingTime;

    return order;
  } catch (error) {
    console.error('Error fetching order status in chatbot service:', error);
    throw new Error('Failed to load order tracking details.');
  }
};

/**
 * Fetch detailed return status, reason, and refund progression for a return ID
 */
const getReturnStatus = async (returnId, userId) => {
  try {
    let queryStr = `
      SELECT r.*, o.total_amount, o.order_status 
      FROM returns r 
      JOIN orders o ON r.order_id = o.id 
      WHERE r.id = $1
    `;
    let queryParams = [returnId];
    if (userId) {
      queryStr += ' AND r.user_id = $2';
      queryParams.push(userId);
    }
    const result = await db.query(queryStr, queryParams);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching return status in orderService:', error);
    throw new Error('Failed to load return status details.');
  }
};

/**
 * Fetch live courier shipment events and locations using a tracking number
 */
const getLiveTracking = async (trackingNumber) => {
  try {
    const orderRes = await db.query(
      `SELECT id, courier_name, tracking_number, order_status, estimated_delivery_date 
       FROM orders 
       WHERE tracking_number = $1`,
      [trackingNumber]
    );

    if (orderRes.rows.length === 0) {
      return { error: 'Tracking number not found. Please verify the tracking number and try again.' };
    }

    const order = orderRes.rows[0];

    const trackingRes = await db.query(
      `SELECT status, location, message, created_at as time
       FROM order_tracking 
       WHERE order_id = $1 
       ORDER BY created_at ASC`,
      [order.id]
    );

    const events = trackingRes.rows;
    const lastLocation = events[events.length - 1]?.location || 'Origin Hub';

    return {
      orderId: order.id,
      courier: order.courier_name || 'Delhivery',
      trackingNumber: order.tracking_number,
      status: order.order_status,
      lastLocation,
      estimatedDelivery: order.estimated_delivery_date 
        ? new Date(order.estimated_delivery_date).toLocaleDateString()
        : 'Pending Estimate',
      trackingEvents: events
    };
  } catch (error) {
    console.error('Error fetching live tracking in orderService:', error);
    return { error: 'Failed to retrieve live tracking details.' };
  }
};

/**
 * Check if a specific order item is eligible for returns based on dynamic settings window
 */
const checkReturnEligibility = async (orderItemId, userId) => {
  if (!userId) return { error: 'Authentication required to check return eligibility.' };
  try {
    const itemRes = await db.query(
      `SELECT oi.id as order_item_id, oi.order_id, oi.price, p.title, p.id as product_id, o.order_status, o.created_at as order_date
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id = p.id
       WHERE oi.id = $1 AND o.user_id = $2`,
      [orderItemId, userId]
    );

    if (itemRes.rows.length === 0) {
      return { error: `Order item with ID #${orderItemId} was not found or does not belong to your account.` };
    }

    const item = itemRes.rows[0];

    if (item.order_status !== 'Delivered') {
      return {
        eligible: false,
        productTitle: item.title,
        message: `This item is not eligible for return because the order status is currently "${item.order_status}". Only delivered items can be returned.`
      };
    }

    const trackingRes = await db.query(
      `SELECT created_at FROM order_tracking 
       WHERE order_id = $1 AND status = 'Delivered' 
       ORDER BY created_at DESC LIMIT 1`,
      [item.order_id]
    );

    let deliveryDate = item.order_date;
    if (trackingRes.rows.length > 0) {
      deliveryDate = trackingRes.rows[0].created_at;
    }

    const { getSystemSettings } = require('../utils/settings.util');
    const settings = await getSystemSettings();
    const isFastTracking = settings.isFastTracking;

    const elapsedMs = new Date().getTime() - new Date(deliveryDate).getTime();
    const windowLimitMs = isFastTracking ? 120 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const eligibleUntil = new Date(new Date(deliveryDate).getTime() + windowLimitMs);

    const isEligible = elapsedMs <= windowLimitMs;

    const returnCheck = await db.query(
      'SELECT id, status FROM returns WHERE order_id = $1 AND order_item_id = $2',
      [item.order_id, orderItemId]
    );

    if (returnCheck.rows.length > 0) {
      return {
        eligible: false,
        productTitle: item.title,
        message: `This item has already been submitted for a return. Current status: ${returnCheck.rows[0].status}.`
      };
    }

    return {
      eligible: isEligible,
      orderItemId,
      orderId: item.order_id,
      productTitle: item.title,
      deliveryDate: new Date(deliveryDate).toLocaleString(),
      eligibleUntil: eligibleUntil.toLocaleString(),
      message: isEligible
        ? `This item is eligible for return until ${eligibleUntil.toLocaleString()}.`
        : `The return window for this item closed on ${eligibleUntil.toLocaleString()} (${isFastTracking ? '120 seconds' : '7 days'} post-delivery).`
    };
  } catch (error) {
    console.error('Error checking return eligibility in orderService:', error);
    return { error: 'Failed to verify return eligibility.' };
  }
};

module.exports = {
  getRecentOrders,
  getOrderStatus,
  getReturnStatus,
  getLiveTracking,
  checkReturnEligibility
};

