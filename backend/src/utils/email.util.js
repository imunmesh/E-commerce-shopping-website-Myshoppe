const transporter = require('../config/email');
const db = require('../db');

// Helper to log emails in the new notification_logs table
const logNotification = async (userId, orderId, type, status) => {
  try {
    await db.query(
      `INSERT INTO notification_logs (user_id, order_id, type, status) VALUES ($1, $2, $3, $4)`,
      [userId, orderId, type, status]
    );
  } catch (error) {
    console.error('Failed to log notification to database:', error);
  }
};

// Send Welcome Email
const sendWelcomeEmail = async (user) => {
  const { id, email, name } = user;
  const subject = 'Welcome to MyShopee! 🎉';

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <p style="color: #718096; margin: 5px 0 0 0;">Your Premium E-Commerce Store</p>
      </div>

      <h2 style="color: #232f3e;">Hello ${name},</h2>
      <p style="color: #4a5568; line-height: 1.6;">Thank you for registering at MyShopee! We are thrilled to have you with us. Explore thousands of hand-picked products, curate your wishlist, and enjoy a seamless premium shopping experience.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="background-color: #f08804; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Start Shopping Now</a>
      </div>

      <p style="color: #718096; font-size: 14px; margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px; text-align: center;">
        If you have any questions, feel free to reply to this email. We're here to help!<br>
        <strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Support" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html,
    });
    console.log(`✅ Welcome email sent successfully to ${email}`);
    await logNotification(id, null, 'welcome_email', 'sent');
  } catch (error) {
    console.error(`❌ Error sending Welcome email to ${email}:`, error.message);
    await logNotification(id, null, 'welcome_email', 'failed');
  }
};

// Send Order Confirmation Email
const sendOrderConfirmationEmail = async (user, order, items, address) => {
  const { id: userId, email, name: customerName } = user;
  const { id: orderId, total_amount, created_at, payment_status } = order;
  const subject = `Order Confirmed - #${orderId} 🛍️`;

  let finalAddress = address;
  if (!finalAddress) {
    try {
      const addressRes = await db.query('SELECT * FROM order_addresses WHERE order_id = $1', [orderId]);
      if (addressRes.rows.length > 0) {
        finalAddress = addressRes.rows[0];
      }
    } catch (err) {
      console.error('Failed to retrieve address snapshot for order email:', err);
    }
  }

  const richItems = [];
  let subtotal = 0;
  for (const item of items) {
    let title = item.title;
    let thumbnail = item.thumbnail;
    let price = parseFloat(item.price);
    
    if (!title || !thumbnail) {
      try {
        const productRes = await db.query(
          `SELECT title, thumbnail FROM products WHERE id = $1`,
          [item.product_id || item.productId]
        );
        if (productRes.rows.length > 0) {
          title = title || productRes.rows[0].title;
          thumbnail = thumbnail || productRes.rows[0].thumbnail;
        }
      } catch (err) {
        console.error('Failed to retrieve product metadata for email:', err);
      }
    }

    const itemTotal = price * item.quantity;
    subtotal += itemTotal;

    richItems.push({
      title: title || 'Product Title',
      quantity: item.quantity,
      price: price,
      thumbnail: thumbnail || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=100',
      total: itemTotal
    });
  }

  const grandTotal = parseFloat(total_amount);
  const tax = subtotal * 0.08;
  const discount = Math.max(0, subtotal + tax - grandTotal);

  const orderDateStr = created_at 
    ? new Date(created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const itemsHtml = richItems.map(item => `
    <tr style="border-bottom: 1px solid #edf2f7;">
      <td style="padding: 12px 10px; vertical-align: middle; width: 50px;">
        <img src="${item.thumbnail}" alt="${item.title}" style="width: 50px; height: 50px; object-fit: contain; border: 1px solid #edf2f7; border-radius: 4px; background-color: #ffffff; padding: 2px;" />
      </td>
      <td style="padding: 12px 10px; vertical-align: middle; color: #2d3748; font-size: 14px; font-weight: 600;">
        ${item.title}
      </td>
      <td style="padding: 12px 10px; vertical-align: middle; text-align: center; color: #4a5568; font-size: 14px;">
        ${item.quantity}
      </td>
      <td style="padding: 12px 10px; vertical-align: middle; text-align: right; color: #4a5568; font-size: 14px;">
        $${item.price.toFixed(2)}
      </td>
      <td style="padding: 12px 10px; vertical-align: middle; text-align: right; color: #131921; font-weight: bold; font-size: 14px;">
        $${item.total.toFixed(2)}
      </td>
    </tr>
  `).join('');

  const addressHtml = finalAddress ? `
    <div style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 15px; margin-top: 10px; font-size: 13px; color: #4a5568; line-height: 1.5;">
      <strong style="color: #2d3748; font-size: 14px; display: block; margin-bottom: 4px;">${finalAddress.full_name}</strong>
      <span style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 8px;">📞 ${finalAddress.phone}</span>
      <p style="margin: 0 0 2px 0;">${finalAddress.address_line_1}</p>
      ${finalAddress.address_line_2 ? `<p style="margin: 0 0 2px 0;">${finalAddress.address_line_2}</p>` : ''}
      ${finalAddress.landmark ? `<p style="margin: 0 0 4px 0; color: #718096; font-size: 11px; font-style: italic;">Landmark: ${finalAddress.landmark}</p>` : ''}
      <p style="margin: 0;">${finalAddress.city}, ${finalAddress.state} - <strong>${finalAddress.pincode}</strong></p>
    </div>
  ` : `<div style="background-color: #fffaf0; border: 1px dashed #feebc8; border-radius: 6px; padding: 15px; text-align: center; color: #dd6b20; font-size: 13px; font-weight: 500;">No shipping address details attached.</div>`;

  const discountHtml = discount > 0.01 ? `
    <div style="display: table-row; font-size: 13px; color: #38a169;">
      <div style="display: table-cell; padding-bottom: 8px;">Discount:</div>
      <div style="display: table-cell; text-align: right; padding-bottom: 8px; font-weight: 600;">-$${discount.toFixed(2)}</div>
    </div>
  ` : '';

  const html = `
    <div style="background-color: #f4f6f8; padding: 30px 10px; font-family: 'Inter', sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background-color: #131921; border-top: 4px solid #f08804; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px;">MyShopee</h1>
          <p style="color: #a0aec0; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase;">Order Confirmed</p>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #2d3748; font-size: 18px; margin-top: 0;">Hello ${customerName},</h2>
          <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">Thank you for shopping with MyShopee. Your order has been successfully placed. We are preparing it for shipment.</p>
          
          <div style="display: table; width: 100%; margin-bottom: 24px;">
            <div style="display: table-row;">
              <div style="display: table-cell; width: 50%; padding-right: 8px;">
                <div style="background-color: #f7fafc; border: 1px solid #edf2f7; padding: 12px; border-radius: 6px;">
                  <span style="font-size: 10px; color: #a0aec0; text-transform: uppercase; display: block;">Order Number</span>
                  <strong style="font-size: 14px; color: #2d3748;">#${orderId}</strong>
                </div>
              </div>
              <div style="display: table-cell; width: 50%; padding-left: 8px;">
                <div style="background-color: #f7fafc; border: 1px solid #edf2f7; padding: 12px; border-radius: 6px;">
                  <span style="font-size: 10px; color: #a0aec0; text-transform: uppercase; display: block;">Order Date</span>
                  <span style="font-size: 13px; color: #4a5568; font-weight: 600;">${orderDateStr}</span>
                </div>
              </div>
            </div>
          </div>

          <h3 style="font-size: 13px; color: #718096; border-bottom: 1px solid #edf2f7; padding-bottom: 6px; text-transform: uppercase;">Delivery Address</h3>
          ${addressHtml}

          <h3 style="font-size: 13px; color: #718096; border-bottom: 1px solid #edf2f7; padding-bottom: 6px; text-transform: uppercase; margin-top: 25px;">Ordered Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid #edf2f7; background-color: #f8fafc;">
                <th colspan="2" style="text-align: left; padding: 8px; font-size: 11px; color: #718096;">Product</th>
                <th style="text-align: center; padding: 8px; font-size: 11px; color: #718096;">Qty</th>
                <th style="text-align: right; padding: 8px; font-size: 11px; color: #718096;">Price</th>
                <th style="text-align: right; padding: 8px; font-size: 11px; color: #718096;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="width: 100%; margin-top: 20px; text-align: right;">
            <div style="display: inline-block; width: 260px; background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 14px; text-align: left;">
              <div style="display: table; width: 100%;">
                <div style="display: table-row; font-size: 13px; color: #4a5568;">
                  <div style="display: table-cell; padding-bottom: 8px;">Subtotal:</div>
                  <div style="display: table-cell; text-align: right; padding-bottom: 8px; font-weight: 600;">$${subtotal.toFixed(2)}</div>
                </div>
                ${discountHtml}
                <div style="display: table-row; font-size: 13px; color: #4a5568;">
                  <div style="display: table-cell; padding-bottom: 8px;">Tax (8%):</div>
                  <div style="display: table-cell; text-align: right; padding-bottom: 8px; font-weight: 600;">$${tax.toFixed(2)}</div>
                </div>
                <div style="display: table-row; font-size: 15px; font-weight: 800; color: #2d3748;">
                  <div style="display: table-cell; padding-top: 10px; border-top: 1px solid #edf2f7;">Grand Total:</div>
                  <div style="display: table-cell; text-align: right; padding-top: 10px; border-top: 1px solid #edf2f7; font-weight: 800; color: #f08804; font-size: 17px;">$${grandTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top: 30px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 25px;">
            <p style="margin: 0 0 6px 0; color: #718096; font-size: 13px;">Estimated Delivery</p>
            <p style="margin: 0 0 20px 0; color: #f08804; font-size: 16px; font-weight: 800;">3-5 Business Days</p>
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders" style="background-color: #f08804; color: white; padding: 12px 32px; text-decoration: none; font-weight: 700; border-radius: 5px; font-size: 14px; display: inline-block;">Track My Order</a>
          </div>
        </div>
        <div style="background-color: #f7fafc; border-top: 1px solid #edf2f7; padding: 24px; text-align: center; color: #718096; font-size: 13px;">
          <p style="margin: 0 0 4px 0; color: #2d3748; font-weight: 700;">Thank you for shopping with MyShopee ❤️</p>
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Orders" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html,
    });
    console.log(`Order Confirmation email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'order_confirmation_email', 'sent');
  } catch (error) {
    console.error(`Error sending Order Confirmation email to ${email}:`, error);
    await logNotification(userId, orderId, 'order_confirmation_email', 'failed');
  }
};

// Send Packed Email
const sendPackedEmail = async (user, order, location = 'Mumbai Warehouse') => {
  const { id: userId, email, name } = user;
  const { id: orderId, estimated_delivery_date } = order;
  const subject = '📦 Your Order Has Been Packed';

  const estDate = estimated_delivery_date 
    ? new Date(estimated_delivery_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'In a few days';

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #fef3c7; color: #d97706; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">PACKED</span>
      </div>
      <h2 style="color: #232f3e;">Hi ${name},</h2>
      <p style="color: #4a5568; line-height: 1.6;">Good news! Your order <strong>#${orderId}</strong> has been packed and is ready for shipment.</p>
      
      <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0 0 5px 0; color: #718096;">Tracking Status:</p>
        <p style="margin: 0 0 10px 0; color: #d97706; font-weight: bold;">Packed & Ready</p>
        <p style="margin: 0 0 5px 0; color: #718096;">Current Location:</p>
        <p style="margin: 0 0 10px 0; color: #2d3748; font-weight: bold;">${location}</p>
        <p style="margin: 0 0 5px 0; color: #718096;">Estimated Delivery Date:</p>
        <p style="margin: 0; color: #f08804; font-weight: bold;">${estDate}</p>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders" style="background-color: #f08804; color: white; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 14px; display: inline-block;">Track Order</a>
      </div>
      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
        Thank you for shopping with MyShopee!<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Support" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Packed email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'packed_email', 'sent');
  } catch (error) {
    console.error(`Error sending Packed email to ${email}:`, error);
    await logNotification(userId, orderId, 'packed_email', 'failed');
  }
};

// Send Shipping Email
const sendShippingEmail = async (user, order, location = 'Mumbai Dispatch Center') => {
  const { id: userId, email, name } = user;
  const { id: orderId, estimated_delivery_date } = order;
  const subject = '🚚 Your Order Has Been Shipped';

  const estDate = estimated_delivery_date 
    ? new Date(estimated_delivery_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'In a few days';

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #e0f2fe; color: #0369a1; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">SHIPPED</span>
      </div>
      <h2 style="color: #232f3e;">Hi ${name},</h2>
      <p style="color: #4a5568; line-height: 1.6;">Your order <strong>#${orderId}</strong> has been shipped and is on its way to you.</p>
      
      <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0 0 5px 0; color: #718096;">Current Location:</p>
        <p style="margin: 0 0 10px 0; color: #0369a1; font-weight: bold;">${location}</p>
        <p style="margin: 0 0 5px 0; color: #718096;">Estimated Delivery Date:</p>
        <p style="margin: 0; color: #f08804; font-weight: bold;">${estDate}</p>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders" style="background-color: #f08804; color: white; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 14px; display: inline-block;">Track Order</a>
      </div>
      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
        Thank you for shopping with MyShopee!<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Support" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Shipping email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'shipped_email', 'sent');
  } catch (error) {
    console.error(`Error sending Shipping email to ${email}:`, error);
    await logNotification(userId, orderId, 'shipped_email', 'failed');
  }
};

// Send Out For Delivery Email
const sendOutForDeliveryEmail = async (user, order, location = 'Local Delivery Center', address = null) => {
  const { id: userId, email, name } = user;
  const { id: orderId, estimated_delivery_date } = order;
  const subject = '📍 Your Order Is Out For Delivery';

  let finalAddress = address;
  if (!finalAddress) {
    try {
      const addressRes = await db.query('SELECT * FROM order_addresses WHERE order_id = $1', [orderId]);
      if (addressRes.rows.length > 0) {
        finalAddress = addressRes.rows[0];
      }
    } catch (err) {
      console.error('Failed to fetch address for out for delivery email:', err);
    }
  }

  const addressBlock = finalAddress 
    ? `<p style="margin: 0; font-weight: bold;">${finalAddress.full_name}</p>
       <p style="margin: 0;">${finalAddress.address_line_1}, ${finalAddress.city}, ${finalAddress.state} - ${finalAddress.pincode}</p>
       <p style="margin: 2px 0 0 0;">📞 Phone: ${finalAddress.phone}</p>`
    : 'Not Provided';

  const estDate = estimated_delivery_date 
    ? new Date(estimated_delivery_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Today';

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #fae8ff; color: #86198f; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">OUT FOR DELIVERY</span>
      </div>
      <h2 style="color: #232f3e;">Hi ${name},</h2>
      <p style="color: #4a5568; line-height: 1.6;">Get ready! Your package for order <strong>#${orderId}</strong> is out for delivery today and will arrive shortly.</p>
      
      <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0 0 5px 0; color: #718096;">Expected Delivery:</p>
        <p style="margin: 0 0 10px 0; color: #86198f; font-weight: bold;">${estDate}</p>
        <p style="margin: 0 0 5px 0; color: #718096;">Delivery Address:</p>
        <div style="margin: 0; color: #2d3748; line-height: 1.4;">${addressBlock}</div>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders" style="background-color: #f08804; color: white; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 14px; display: inline-block;">Track Live Delivery</a>
      </div>
      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
        Thank you for choosing MyShopee!<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Courier" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Out for delivery email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'out_for_delivery_email', 'sent');
  } catch (error) {
    console.error(`Error sending Out for delivery email to ${email}:`, error);
    await logNotification(userId, orderId, 'out_for_delivery_email', 'failed');
  }
};

// Send Delivery Email
const sendDeliveryEmail = async (user, order, location = 'Customer Address', address = null) => {
  const { id: userId, email, name } = user;
  const { id: orderId } = order;
  const subject = '✅ Order Delivered Successfully';

  let finalAddress = address;
  if (!finalAddress) {
    try {
      const addressRes = await db.query('SELECT * FROM order_addresses WHERE order_id = $1', [orderId]);
      if (addressRes.rows.length > 0) {
        finalAddress = addressRes.rows[0];
      }
    } catch (err) {
      console.error('Failed to fetch address for delivery email:', err);
    }
  }

  const addressBlock = finalAddress 
    ? `<p style="margin: 0; font-weight: bold;">${finalAddress.full_name}</p>
       <p style="margin: 0;">${finalAddress.address_line_1}, ${finalAddress.city}, ${finalAddress.state} - ${finalAddress.pincode}</p>`
    : 'Not Provided';

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #d1fae5; color: #065f46; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">DELIVERED</span>
      </div>
      <h2 style="color: #232f3e;">Your order has been delivered! 🎉</h2>
      <p style="color: #4a5568; line-height: 1.6;">Hi ${name}, order <strong>#${orderId}</strong> has been delivered successfully. Thank you so much for shopping with us! We hope you love your new products.</p>
      
      <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0 0 5px 0; color: #718096;">Delivered To:</p>
        <div style="margin: 0; color: #2d3748; line-height: 1.4;">${addressBlock}</div>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders" style="background-color: #f08804; color: white; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 14px; display: inline-block;">Review Your Products</a>
      </div>
      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
        Thank you for shopping with MyShopee ❤️<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Support" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Delivery email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'delivered_email', 'sent');
  } catch (error) {
    console.error(`Error sending Delivery email to ${email}:`, error);
    await logNotification(userId, orderId, 'delivered_email', 'failed');
  }
};

// Send Refund Email
const sendRefundEmail = async (user, order) => {
  const { id: userId, email, name } = user;
  const { id: orderId, total_amount } = order;
  const subject = `💰 Refund Processed - Order #${orderId}`;

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #fee2e2; color: #991b1b; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">REFUNDED</span>
      </div>
      <h2 style="color: #232f3e;">Refund Confirmed</h2>
      <p style="color: #4a5568; line-height: 1.6;">Hello ${name}, your refund for order <strong>#${orderId}</strong> has been successfully processed.</p>
      
      <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0 0 5px 0; color: #718096;">Refunded Amount:</p>
        <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 18px;">$${parseFloat(total_amount).toFixed(2)}</p>
      </div>

      <p style="color: #4a5568; line-height: 1.6;">The refund should appear in your original bank/card statement in 5-7 business days depending on your financial institution.</p>
      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 30px;">
        Thank you for shopping with MyShopee ❤️<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Billing" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Refund email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'refund_email', 'sent');
  } catch (error) {
    console.error(`Error sending Refund email to ${email}:`, error);
    await logNotification(userId, orderId, 'refund_email', 'failed');
  }
};

// Send Return Requested Email
const sendReturnRequestedEmail = async (user, returnRequest) => {
  const { id: userId, email, name } = user;
  const { id: returnId, order_id: orderId, reason } = returnRequest;
  const subject = `📤 Return Request Submitted - Order #${orderId}`;

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">RETURN REQUESTED</span>
      </div>
      <h2 style="color: #232f3e;">Return Request Received</h2>
      <p style="color: #4a5568; line-height: 1.6;">Hello ${name}, we have successfully received your return request for order <strong>#${orderId}</strong>.</p>
      
      <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0 0 5px 0; color: #718096;">Return Request ID: <strong>#${returnId}</strong></p>
        <p style="margin: 0; color: #2d3748;">Reason: <strong>${reason}</strong></p>
      </div>

      <p style="color: #4a5568; line-height: 1.6;">Our return support team is currently reviewing your request. We will update you as soon as the status changes.</p>
      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 30px;">
        Thank you for shopping with MyShopee ❤️<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Support" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Return Requested email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'return_requested_email', 'sent');
  } catch (error) {
    console.error(`Error sending Return Requested email to ${email}:`, error);
    await logNotification(userId, orderId, 'return_requested_email', 'failed');
  }
};

// Send Return Approved Email
const sendReturnApprovedEmail = async (user, returnRequest) => {
  const { id: userId, email, name } = user;
  const { id: returnId, order_id: orderId } = returnRequest;
  const subject = `✅ Return Request Approved - Order #${orderId}`;

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #d1fae5; color: #065f46; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">APPROVED</span>
      </div>
      <h2 style="color: #232f3e;">Return Approved</h2>
      <p style="color: #4a5568; line-height: 1.6;">Hello ${name}, your return request for order <strong>#${orderId}</strong> (Request ID: #${returnId}) has been approved by our support team.</p>
      <p style="color: #4a5568; line-height: 1.6;">The next step is package pickup. We will schedule a courier partner to collect the item from your address.</p>
      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 30px;">
        Thank you for shopping with MyShopee ❤️<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Support" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Return Approved email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'return_approved_email', 'sent');
  } catch (error) {
    console.error(`Error sending Return Approved email to ${email}:`, error);
    await logNotification(userId, orderId, 'return_approved_email', 'failed');
  }
};

// Send Pickup Scheduled Email
const sendPickupScheduledEmail = async (user, returnRequest) => {
  const { id: userId, email, name } = user;
  const { id: returnId, order_id: orderId } = returnRequest;
  const subject = `🚚 Return Pickup Scheduled - Order #${orderId}`;

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #dbeafe; color: #1e40af; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">PICKUP SCHEDULED</span>
      </div>
      <h2 style="color: #232f3e;">Pickup Scheduled</h2>
      <p style="color: #4a5568; line-height: 1.6;">Hello ${name}, a pickup has been scheduled for your returned package from Order <strong>#${orderId}</strong>.</p>
      
      <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0; color: #2d3748;">Our courier partner will arrive at your registered delivery address within the next 24-48 hours to collect the item. Please ensure the product is packed in its original packaging with tags intact.</p>
      </div>

      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 30px;">
        Thank you for shopping with MyShopee ❤️<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Support" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Return Pickup Scheduled email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'return_pickup_scheduled_email', 'sent');
  } catch (error) {
    console.error(`Error sending Return Pickup Scheduled email to ${email}:`, error);
    await logNotification(userId, orderId, 'return_pickup_scheduled_email', 'failed');
  }
};

// Send Refund Processing Email
const sendRefundProcessingEmail = async (user, returnRequest) => {
  const { id: userId, email, name } = user;
  const { id: returnId, order_id: orderId } = returnRequest;
  const subject = `💸 Refund Processing - Order #${orderId}`;

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #e0f2fe; color: #0369a1; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">REFUND PROCESSING</span>
      </div>
      <h2 style="color: #232f3e;">Refund is Being Processed</h2>
      <p style="color: #4a5568; line-height: 1.6;">Hello ${name}, your returned items for order <strong>#${orderId}</strong> have been received and inspected at our warehouse.</p>
      <p style="color: #4a5568; line-height: 1.6;">We have initiated your refund transaction through Stripe. The funds are currently processing and will be credited to your original payment method shortly.</p>
      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 30px;">
        Thank you for shopping with MyShopee ❤️<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Billing" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Refund Processing email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'refund_processing_email', 'sent');
  } catch (error) {
    console.error(`Error sending Refund Processing email to ${email}:`, error);
    await logNotification(userId, orderId, 'refund_processing_email', 'failed');
  }
};

// Send Review Reminder Email
const sendReviewReminderEmail = async (user, order) => {
  const { id: userId, email, name } = user;
  const { id: orderId } = order;
  const subject = '📧 How was your purchase?';

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #eff6ff; color: #1e40af; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">REVIEW REMINDER</span>
      </div>
      <h2 style="color: #232f3e;">How was your purchase, ${name}?</h2>
      <p style="color: #4a5568; line-height: 1.6;">We hope you are enjoying the items from your order <strong>#${orderId}</strong>. We would love to hear your feedback!</p>
      <p style="color: #4a5568; line-height: 1.6;">Your honest rating and review help other buyers make better purchasing decisions and allow us to continue providing the best products.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders" style="background-color: #f08804; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Leave a Review</a>
      </div>
      <p style="color: #718096; font-size: 12px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
        Thank you for shopping with MyShopee ❤️<br><strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Reviews" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html
    });
    console.log(`Review reminder email sent to ${email} for Order #${orderId}`);
    await logNotification(userId, orderId, 'review_reminder_email', 'sent');
  } catch (error) {
    console.error(`Error sending Review reminder email to ${email}:`, error);
    await logNotification(userId, orderId, 'review_reminder_email', 'failed');
  }
};

const sendRefundCompletedEmail = sendRefundEmail;

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendPackedEmail,
  sendShippingEmail,
  sendOutForDeliveryEmail,
  sendDeliveryEmail,
  sendRefundEmail,
  sendReviewReminderEmail,
  sendReturnRequestedEmail,
  sendReturnApprovedEmail,
  sendPickupScheduledEmail,
  sendRefundProcessingEmail,
  sendRefundCompletedEmail,
  logNotification
};
