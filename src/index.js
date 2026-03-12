require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/database');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const { cashfreeConfig } = require('./config/cashfree');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['https://payment-server-314.onrender.com'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body parsing ────────────────────────────────────────────────────────────
// Note: /api/payments/webhook uses its own raw body parser (see payments route).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ────────────────────────────────────────────────────────────
if (require.main === module) {
  logger.info('Cashfree Configuration Loaded', {
    appId: cashfreeConfig.appId ? '***' : 'NOT SET ❌',
    secretKey: cashfreeConfig.secretKey ? '***' : 'NOT SET ❌',
    apiUrl: cashfreeConfig.apiUrl,
    nodeEnv: process.env.NODE_ENV,
  });
  connectDB().then(() => {
    app.listen(PORT, () => {
      logger.info(`Payment server running on port ${PORT}`);
    });
  });
}

module.exports = app;
