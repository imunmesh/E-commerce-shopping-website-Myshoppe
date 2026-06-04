const PDFDocument = require('pdfkit');

/**
 * Dynamically generates a professional PDF invoice and streams it to the response.
 * @param {Object} order - Order details
 * @param {Array} items - Purchased items details
 * @param {Object} address - Shipping address snapshot
 * @param {Object} user - Customer metadata
 * @param {Object} res - Express Response object to stream the PDF to
 */
const generateInvoicePDF = (order, items, address, user, res) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Stream PDF directly to client response
  doc.pipe(res);

  // Colors Palette
  const darkNavy = '#131921';
  const orangeAccent = '#f08804';
  const textDark = '#2d3748';
  const textMuted = '#718096';
  const lightBg = '#f7fafc';
  const borderLight = '#edf2f7';

  // --- HEADER SECTION ---
  doc.rect(0, 0, 595.28, 120) // Full width top header block
     .fill(darkNavy);
  
  doc.rect(0, 116, 595.28, 4) // Orange border accent
     .fill(orangeAccent);

  // MyShopee Logo / Branding Text
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(28)
     .text('MyShopee', 50, 40);

  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#a0aec0')
     .text('YOUR PREMIUM E-COMMERCE DESTINATION', 50, 75);

  // "INVOICE" Title text right-aligned
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(24)
     .text('INVOICE', 400, 45, { align: 'right', width: 145 });

  // Move cursor down to post-header region
  doc.y = 150;

  // --- BILLING / ORDER DETAILS GRID ---
  doc.fillColor(textDark);
  
  // Left Column: Order metadata
  const leftX = 50;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(textMuted).text('ORDER DETAILS', leftX, 150);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(textDark).text('Order ID: ', leftX, 170)
     .font('Helvetica').text(`#${order.id}`, leftX + 60, 170);
  doc.font('Helvetica-Bold').text('Invoice No: ', leftX, 185)
     .font('Helvetica').text(order.invoice_number || `INV-${order.id}`, leftX + 65, 185);
  doc.font('Helvetica-Bold').text('Order Date: ', leftX, 200)
     .font('Helvetica').text(new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), leftX + 65, 200);
  doc.font('Helvetica-Bold').text('Payment: ', leftX, 215)
     .font('Helvetica-Bold').fillColor('#2b6cb0').text((order.payment_status || 'Paid').toUpperCase(), leftX + 60, 215);

  // Right Column: Customer Info
  const rightX = 320;
  doc.fillColor(textMuted).font('Helvetica-Bold').fontSize(11).text('DELIVER TO', rightX, 150);
  
  if (address) {
    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(10).text(address.full_name, rightX, 170);
    doc.font('Helvetica').fillColor(textMuted).text(`Phone: ${address.phone}`, rightX, 185);
    
    // Format full address paragraph
    const addrLines = [
      address.address_line_1,
      address.address_line_2,
      address.landmark ? `Landmark: ${address.landmark}` : null,
      `${address.city}, ${address.state} - ${address.pincode}`,
      address.country || 'India'
    ].filter(Boolean);

    let currentY = 200;
    addrLines.forEach(line => {
      doc.fillColor(textDark).font('Helvetica').fontSize(9).text(line, rightX, currentY);
      currentY += 13;
    });
  } else {
    doc.fillColor(textDark).font('Helvetica-Oblique').fontSize(9).text('No delivery address details attached.', rightX, 170);
  }

  // --- PRODUCTS TABLE ---
  doc.y = 280;
  
  // Table headers
  const colNameX = 50;
  const colQtyX = 350;
  const colPriceX = 410;
  const colTotalX = 490;

  doc.rect(50, doc.y, 495, 20).fill(lightBg);
  doc.fillColor(textMuted).font('Helvetica-Bold').fontSize(9);
  doc.text('PRODUCT NAME', colNameX + 10, doc.y + 6);
  doc.text('QTY', colQtyX, doc.y + 6, { width: 40, align: 'center' });
  doc.text('UNIT PRICE', colPriceX, doc.y + 6, { width: 70, align: 'right' });
  doc.text('TOTAL', colTotalX, doc.y + 6, { width: 55, align: 'right' });

  // Border line under header
  doc.moveTo(50, doc.y + 20).lineTo(545, doc.y + 20).strokeColor(borderLight).stroke();

  doc.y += 20;

  // Render items rows
  let subtotal = 0;
  items.forEach(item => {
    const itemPrice = parseFloat(item.price);
    const itemTotal = itemPrice * item.quantity;
    subtotal += itemTotal;

    // Check page boundaries
    if (doc.y > 700) {
      doc.addPage();
      // Draw minimal header on new pages
      doc.rect(0, 0, 595.28, 40).fill(darkNavy);
      doc.y = 60;
    }

    doc.fillColor(textDark).font('Helvetica').fontSize(9);
    
    // Product Title (with text wrapping support)
    const originalY = doc.y;
    doc.text(item.title || 'Product Title', colNameX + 10, originalY + 8, { width: 280 });
    const textHeight = doc.heightOfString(item.title || 'Product Title', { width: 280 });
    const rowHeight = Math.max(30, textHeight + 16);

    // Qty, unit price, total price
    doc.text(item.quantity.toString(), colQtyX, originalY + 8, { width: 40, align: 'center' });
    doc.text(`$${itemPrice.toFixed(2)}`, colPriceX, originalY + 8, { width: 70, align: 'right' });
    doc.text(`$${itemTotal.toFixed(2)}`, colTotalX, originalY + 8, { width: 55, align: 'right' });

    // Move Y cursor to next row
    doc.y = originalY + rowHeight;
    // Draw row separator line
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(borderLight).stroke();
  });

  // Check page boundaries before pricing summary
  if (doc.y > 600) {
    doc.addPage();
    doc.rect(0, 0, 595.28, 40).fill(darkNavy);
    doc.y = 60;
  }

  // --- PRICING SUMMARY ---
  const summaryX = 350;
  doc.y += 15;

  const gst = subtotal * 0.18; // GST at 18%
  const shipping = 0; // Free shipping
  const discountAmount = parseFloat(order.discount_amount || 0);
  const grandTotal = parseFloat(order.total_amount);

  const drawSummaryRow = (label, value, isBold = false, isOrange = false) => {
    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(10)
       .fillColor(isOrange ? orangeAccent : textDark);
    
    doc.text(label, summaryX, doc.y, { width: 110, align: 'left' });
    doc.text(value, colTotalX, doc.y, { width: 55, align: 'right' });
    doc.y += 18;
  };

  drawSummaryRow('Subtotal:', `$${subtotal.toFixed(2)}`);
  drawSummaryRow('GST (18%):', `$${gst.toFixed(2)}`);
  drawSummaryRow('Shipping Charges:', 'FREE');
  if (discountAmount > 0.01) {
    drawSummaryRow('Discount Applied:', `-$${discountAmount.toFixed(2)}`, false, false);
  }
  
  // Separation line before grand total
  doc.moveTo(summaryX, doc.y).lineTo(545, doc.y).strokeColor(orangeAccent).stroke();
  doc.y += 6;
  drawSummaryRow('Grand Total:', `$${grandTotal.toFixed(2)}`, true, true);

  // --- FOOTER SECTION ---
  doc.y = 740;
  // Border line above footer
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(borderLight).stroke();
  
  doc.y += 15;
  doc.fillColor(textDark)
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('Thank You for Shopping with MyShopee ❤️', 50, doc.y, { align: 'center', width: 495 });

  doc.y += 14;
  doc.fillColor(textMuted)
     .font('Helvetica')
     .fontSize(8.5)
     .text('Support Email: support@myshopee.com   |   Support Phone: +1-800-MY-SHOPEE', 50, doc.y, { align: 'center', width: 495 });

  doc.y += 12;
  doc.text(`© ${new Date().getFullYear()} MyShopee Inc. All rights reserved.`, 50, doc.y, { align: 'center', width: 495 });

  // Finalize Document
  doc.end();
};

module.exports = {
  generateInvoicePDF
};
