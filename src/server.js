require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./prisma');
const apiRoutes = require('./routes/api.routes');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(require('./services/maintenance.service').trackHttp);
app.set('trust proxy', 'loopback');
app.use('/api', (req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

// Local request logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root Information Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Car Wash & Detailing Management API',
    status: 'ONLINE',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      ledger_balances: 'GET /api/ledger',
      payment: 'POST /api/payment',
      expense: 'POST /api/expense'
    }
  });
});

// Mount API routes
const authAttempts = new Map();
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && (['/auth/login', '/auth/verify-pin', '/admin/verify-pin'].includes(req.path) || req.body?.admin_pin)) {
    const k = req.ip;
    const now = Date.now();
    const row = authAttempts.get(k) || {
      count: 0,
      until: now + 60000
    };
    if (now > row.until) {
      row.count = 0;
      row.until = now + 60000;
    }
    row.count++;
    authAttempts.set(k, row);
    if (row.count > 30) return res.status(429).json({
      status: 'error',
      message: 'Too many attempts. Wait a minute.'
    });
    if (authAttempts.size > 10000) for (const [key, value] of authAttempts) if (value.until < now) authAttempts.delete(key);
  }
  next();
});
app.use('/api', apiRoutes);

// Static Asset Serving (Digital Vehicle Inspection Uploads)
const path = require('path');
const fs = require('fs');
const publicPath = path.join(__dirname, '../public');
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, {
    recursive: true
  });
}
const uploadsVehiclesPath = path.join(publicPath, 'uploads/vehicles');
if (!fs.existsSync(uploadsVehiclesPath)) {
  fs.mkdirSync(uploadsVehiclesPath, {
    recursive: true
  });
}
const {
  authenticateUser
} = require('./middleware/auth.middleware');
app.use('/public', authenticateUser, express.static(publicPath));
app.use('/uploads', authenticateUser, express.static(path.join(publicPath, 'uploads')));

// Static Client Serving (Single-Port Local Mode)
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath,{setHeaders:(res,file)=>{if(file.endsWith('sw.js')||file.endsWith('index.html')||file.endsWith('manifest.webmanifest'))res.setHeader('Cache-Control','no-cache');}}));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/public')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    status: 'error',
    message: statusCode < 500 ? err.message : 'The server could not complete this operation. Retry safely or contact the owner.',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
});
const {
  initSettings
} = require('./services/settings.service');
const cameraController = require('./hardware/camera.controller');
const {
  initEodCron
} = require('./cron/eod.cron');
const {
  initOutboxWorker,
  stopOutboxWorker
} = require('./workers/outbox.worker');

// Server Initialization
let server;
if (process.env.NODE_ENV !== 'test') {
  require('./services/shop-backup.service').getService().recoverOnBoot().then(initSettings).then(() => {
    // Initialize Hardware Camera controller with current feature flag
    cameraController.init();

    // Initialize 23:59 EOD Financial Settlement Daemon
    initEodCron();

    // Initialize Decoupled Telegram Alert Outbox Daemon (5s poll)
    initOutboxWorker();
    require('./workers/arrival.worker').initArrivalWorker();
    require('./cron/backup.cron').initBackupCron();
    server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` Car Wash Management System - Core API`);
      console.log(` Server running locally on: http://localhost:${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=======================================================`);
    });
  }).catch(e => { console.error('[Startup recovery]', e.message); process.exitCode = 1; });
}

// Graceful Shutdown
const handleShutdown = async signal => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  cameraController.stopListener();
  stopOutboxWorker();
  require('./workers/arrival.worker').stopArrivalWorker();
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await prisma.$disconnect();
      console.log('Prisma client disconnected.');
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
};
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
module.exports = app;
