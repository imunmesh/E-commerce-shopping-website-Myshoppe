const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Security Headers
app.use(helmet());

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Private Network Access (PNA) Preflight CORS Middleware
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

// 2. CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:54872',
      'http://127.0.0.1:54872'
    ];
    
    if (process.env.CLIENT_URL) {
      allowedOrigins.push(process.env.CLIENT_URL);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 3. API Rate Limiting (to prevent brute-force and DDoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  skip: (req, res) => {
    // Disable rate limiting in development mode
    if (process.env.NODE_ENV === 'development') return true;
    // Skip rate limiting for polling / high-frequency sync routes
    const skipPaths = ['/api/auth/sync', '/api/notifications'];
    return skipPaths.some(path => req.originalUrl.startsWith(path));
  },
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all API routes
app.use('/api', limiter);

// 4. Stripe Webhook Raw Body Middleware (MUST be before express.json())
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// 5. Global Body Parsers for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MyShopee backend server is running smoothly.' });
});

// 6. Mount Application Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/wishlist', require('./routes/wishlist.routes'));
app.use('/api/payment', require('./routes/payment.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/coupons', require('./routes/coupon.routes'));
app.use('/api/compare', require('./routes/compare.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/addresses', require('./routes/address.routes'));
app.use('/api/returns', require('./routes/return.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));

// 7. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Global Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 MyShopee Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`🔌 Listening on Port: ${PORT}`);
  console.log(`==================================================`);
  
  // Start automated order tracking & review reminder background worker
  try {
    require('./services/trackingAutomation').start();
  } catch (err) {
    console.error('Failed to start tracking automation worker:', err);
  }
});

