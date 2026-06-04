const transporter = require('../config/email');
const db = require('../db');

// Helper to log emails in the DB
const logEmail = async (userId, emailType, status) => {
  try {
    await db.query(
      `INSERT INTO email_logs (user_id, email_type, status) VALUES ($1, $2, $3)`,
      [userId, emailType, status]
    );
  } catch (error) {
    console.error('Failed to log email to database:', error);
  }
};

// Send Welcome Email
const sendWelcomeEmail = async (user) => {
  console.log(`📧 Entering sendWelcomeEmail function for user: ${user.email}, ID: ${user.id}`);
  console.log(`📧 FROM: ${process.env.EMAIL_FROM}`);
  console.log(`📧 BREVO_USER: ${process.env.BREVO_USER}`);
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
    console.log(`📤 Attempting to send email to: ${email}`);
    console.log(`📤 From: "MyShopee Support" <${process.env.EMAIL_FROM}>`);
    console.log(`📤 Subject: ${subject}`);

    const result = await transporter.sendMail({
      from: `"MyShopee Support" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html,
    });

    console.log(`✅ Welcome email sent successfully to ${email}`);
    console.log(`📧 Email result:`, result);
    await logEmail(id, 'welcome', 'sent');
  } catch (error) {
    console.error(`❌ Error sending Welcome email to ${email}:`);
    console.error(`❌ Error code:`, error.code);
    console.error(`❌ Error message:`, error.message);
    console.error(`❌ Full error:`, error);
    await logEmail(id, 'welcome', 'failed');
  }
};

// Send Order Confirmation Email
const sendOrderConfirmationEmail = async (user, order, items, address) => {
  const { id: userId, email, name: customerName } = user;
  const { id: orderId, total_amount, created_at, payment_status } = order;
  const subject = `Order Confirmed - #${orderId} 🛍️`;

  // Fetch missing address snapshot if not passed
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

  // Populate rich items with missing thumbnails/titles
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

  // Math summary
  const grandTotal = parseFloat(total_amount);
  const tax = subtotal * 0.08;
  const discount = Math.max(0, subtotal + tax - grandTotal);

  // Formatting date
  const orderDateStr = created_at 
    ? new Date(created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Generate Table Rows HTML
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

  // Address block HTML
  const addressHtml = finalAddress ? `
    <div style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 15px; margin-top: 10px; font-size: 13px; color: #4a5568; line-height: 1.5;">
      <strong style="color: #2d3748; font-size: 14px; display: block; margin-bottom: 4px;">${finalAddress.full_name}</strong>
      <span style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 8px;">📞 ${finalAddress.phone}</span>
      <p style="margin: 0 0 2px 0;">${finalAddress.address_line_1}</p>
      ${finalAddress.address_line_2 ? `<p style="margin: 0 0 2px 0;">${finalAddress.address_line_2}</p>` : ''}
      ${finalAddress.landmark ? `<p style="margin: 0 0 4px 0; color: #718096; font-size: 11px; font-style: italic;">Landmark: ${finalAddress.landmark}</p>` : ''}
      <p style="margin: 0;">${finalAddress.city}, ${finalAddress.state} - <strong>${finalAddress.pincode}</strong></p>
      <p style="margin: 2px 0 0 0; text-transform: uppercase; font-size: 11px; font-weight: bold; color: #a0aec0;">${finalAddress.country || 'India'}</p>
    </div>
  ` : `<div style="background-color: #fffaf0; border: 1px dashed #feebc8; border-radius: 6px; padding: 15px; text-align: center; color: #dd6b20; font-size: 13px; font-weight: 500;">No shipping address details attached.</div>`;

  // Summary card HTML
  const discountHtml = discount > 0.01 ? `
    <div style="display: table-row; font-size: 13px; color: #38a169;">
      <div style="display: table-cell; padding-bottom: 8px;">Discount:</div>
      <div style="display: table-cell; text-align: right; padding-bottom: 8px; font-weight: 600;">-$${discount.toFixed(2)}</div>
    </div>
  ` : '';

  const html = `
    <div style="background-color: #f4f6f8; padding: 30px 10px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-size-adjust: 100%;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
        
        <!-- Header -->
        <div style="background-color: #131921; border-top: 4px solid #f08804; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">MyShopee</h1>
          <p style="color: #a0aec0; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Order Confirmed</p>
        </div>

        <!-- Body -->
        <div style="padding: 30px;">
          <h2 style="color: #2d3748; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Hello ${customerName},</h2>
          <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
            Thank you for shopping with MyShopee. Your order has been successfully placed. We are preparing it for shipment.
          </p>

          <!-- Order Info Grid -->
          <div style="display: table; width: 100%; margin-bottom: 24px;">
            <div style="display: table-row;">
              <div style="display: table-cell; width: 50%; vertical-align: top; padding-right: 8px;">
                <div style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 12px 16px; min-height: 55px;">
                  <span style="font-size: 10px; font-weight: 700; color: #a0aec0; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Order Number</span>
                  <span style="font-size: 14px; font-weight: 700; color: #2d3748;">#${orderId}</span>
                </div>
              </div>
              <div style="display: table-cell; width: 50%; vertical-align: top; padding-left: 8px;">
                <div style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 12px 16px; min-height: 55px;">
                  <span style="font-size: 10px; font-weight: 700; color: #a0aec0; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Order Date</span>
                  <span style="font-size: 13px; font-weight: 600; color: #4a5568;">${orderDateStr}</span>
                </div>
              </div>
            </div>
            <div style="display: table-row;">
              <div style="display: table-cell; width: 50%; vertical-align: top; padding-right: 8px; padding-top: 12px;">
                <div style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 12px 16px; min-height: 55px;">
                  <span style="font-size: 10px; font-weight: 700; color: #a0aec0; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Payment Status</span>
                  <span style="font-size: 12px; font-weight: 700; color: #2b6cb0; text-transform: uppercase; display: inline-block; padding: 2px 6px; background-color: #ebf8ff; border-radius: 4px; border: 1px solid #bee3f8; margin-top: 2px;">
                    ${payment_status || 'Paid'}
                  </span>
                </div>
              </div>
              <div style="display: table-cell; width: 50%; vertical-align: top; padding-left: 8px; padding-top: 12px;">
                <div style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 12px 16px; min-height: 55px;">
                  <span style="font-size: 10px; font-weight: 700; color: #a0aec0; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Total Amount</span>
                  <span style="font-size: 15px; font-weight: 800; color: #f08804;">$${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Delivery Address -->
          <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #718096; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #edf2f7; padding-bottom: 6px;">
            Delivery Address
          </h3>
          ${addressHtml}

          <!-- Ordered Products Table -->
          <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #718096; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #edf2f7; padding-bottom: 6px;">
            Ordered Items
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 5px;">
            <thead>
              <tr style="border-bottom: 2px solid #edf2f7; background-color: #f8fafc;">
                <th colspan="2" style="text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase;">Product Details</th>
                <th style="text-align: center; padding: 8px 10px; font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase; width: 50px;">Qty</th>
                <th style="text-align: right; padding: 8px 10px; font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase; width: 70px;">Price</th>
                <th style="text-align: right; padding: 8px 10px; font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase; width: 80px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Order Summary Section -->
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
                <div style="display: table-row; font-size: 13px; color: #4a5568;">
                  <div style="display: table-cell; padding-bottom: 8px;">Shipping:</div>
                  <div style="display: table-cell; text-align: right; padding-bottom: 8px; font-weight: 600; color: #38a169;">FREE</div>
                </div>
                <div style="display: table-row; font-size: 15px; font-weight: 800; color: #2d3748; border-top: 1px solid #e2e8f0;">
                  <div style="display: table-cell; padding-top: 10px; border-top: 1px solid #edf2f7;">Grand Total:</div>
                  <div style="display: table-cell; text-align: right; padding-top: 10px; border-top: 1px solid #edf2f7; font-weight: 800; color: #f08804; font-size: 17px;">$${grandTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Estimated Delivery & Tracking Button -->
          <div style="margin-top: 30px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 25px;">
            <p style="margin: 0 0 6px 0; color: #718096; font-size: 13px; font-weight: 500;">Estimated Delivery</p>
            <p style="margin: 0 0 20px 0; color: #f08804; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">3-5 Business Days</p>
            
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders" style="background-color: #f08804; color: #ffffff !important; padding: 12px 32px; text-decoration: none; font-weight: 700; border-radius: 5px; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px rgba(240, 136, 4, 0.15);">
              Track My Order
            </a>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f7fafc; border-top: 1px solid #edf2f7; padding: 24px; text-align: center; color: #718096; font-size: 13px; line-height: 1.6;">
          <p style="margin: 0 0 4px 0; color: #2d3748; font-weight: 700; font-size: 14px;">Thank you for shopping with MyShopee ❤️</p>
          <p style="margin: 0;">If you have any questions, please contact our support team.</p>
          <p style="margin: 15px 0 0 0; font-size: 11px; color: #a0aec0;">&copy; ${new Date().getFullYear()} MyShopee Inc. All rights reserved.</p>
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
    await logEmail(userId, 'order_confirmation', 'sent');
  } catch (error) {
    console.error(`Error sending Order Confirmation email to ${email}:`, error);
    await logEmail(userId, 'order_confirmation', 'failed');
  }
};

// Send Shipping Email
const sendShippingEmail = async (user, order) => {
  const { id: userId, email, name } = user;
  const { id: orderId } = order;
  const subject = `Your Order #${orderId} Has Shipped! 🚚`;

  const deliveryEstimate = new Date();
  deliveryEstimate.setDate(deliveryEstimate.getDate() + 2); // 2 days left
  const formattedEstimate = deliveryEstimate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #e3f2fd; color: #0d47a1; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">SHIPPED</span>
      </div>
      
      <h2 style="color: #232f3e;">Good news, ${name}!</h2>
      <p style="color: #4a5568; line-height: 1.6;">Your order <strong>#${orderId}</strong> has been handed over to our shipping partner and is on its way to you.</p>
      
      <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0 0 5px 0; color: #718096; font-size: 14px;">Current Status:</p>
        <p style="margin: 0 0 15px 0; color: #2b6cb0; font-weight: bold; font-size: 16px;">Shipped</p>
        
        <p style="margin: 0 0 5px 0; color: #718096; font-size: 14px;">Updated Delivery Estimate:</p>
        <p style="margin: 0; color: #f08804; font-weight: bold; font-size: 16px;">${formattedEstimate}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders" style="background-color: #f08804; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 16px;">Track Shipment</a>
      </div>
      
      <p style="color: #718096; font-size: 14px; margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px; text-align: center;">
        Your patience is highly appreciated.<br>
        <strong>MyShopee Team</strong>
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MyShopee Shipping" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html,
    });
    console.log(`Shipping email sent to ${email} for Order #${orderId}`);
    await logEmail(userId, 'shipping', 'sent');
  } catch (error) {
    console.error(`Error sending Shipping email to ${email}:`, error);
    await logEmail(userId, 'shipping', 'failed');
  }
};

// Send Delivery Email
const sendDeliveryEmail = async (user, order) => {
  const { id: userId, email, name } = user;
  const { id: orderId } = order;
  const subject = `Delivered: Order #${orderId} 🎁`;

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #f08804; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #131921; margin: 0; font-size: 28px;">MyShopee</h1>
        <span style="background-color: #def7ec; color: #03543f; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-top: 10px;">DELIVERED</span>
      </div>
      
      <h2 style="color: #232f3e;">Delivered! 🎉</h2>
      <p style="color: #4a5568; line-height: 1.6;">Hi ${name}, your package for order <strong>#${orderId}</strong> has been successfully delivered. We hope you love your new products!</p>
      
      <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px dashed #e2e8f0;">
        <h3 style="margin-top: 0; color: #131921; text-align: center;">How did we do?</h3>
        <p style="color: #4a5568; text-align: center; font-size: 14px; margin-bottom: 20px;">We'd love to hear your thoughts. Leave a review for the products and rate your shopping experience!</p>
        <div style="text-align: center;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/orders" style="background-color: #f08804; color: white; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 14px; display: inline-block;">Write Product Reviews</a>
        </div>
      </div>
      
      <p style="color: #718096; font-size: 14px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 20px; margin-top: 30px;">
        If you have any feedback or concerns regarding your delivery, please contact our support team.<br>
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
    console.log(`Delivery confirmation email sent to ${email} for Order #${orderId}`);
    await logEmail(userId, 'delivery', 'sent');
  } catch (error) {
    console.error(`Error sending Delivery confirmation email to ${email}:`, error);
    await logEmail(userId, 'delivery', 'failed');
  }
};

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendShippingEmail,
  sendDeliveryEmail,
};
