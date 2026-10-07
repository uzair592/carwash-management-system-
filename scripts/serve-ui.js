/**
 * Dedicated Static File Server for Production UI (Port 3000)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.UI_PORT || 3000;
const DIST_PATH = path.join(__dirname, '../client/dist');

if (!fs.existsSync(DIST_PATH)) {
  console.error(`[ServeUI] Error: client/dist directory does not exist at ${DIST_PATH}.`);
  console.error('Please run "npm run build:ui" first.');
  process.exit(1);
}

// Serve static assets
app.use(express.static(DIST_PATH));

// Single Page Application Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_PATH, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Car Wash Management System - Production UI`);
  console.log(` Frontend is LIVE locally on: http://localhost:${PORT}`);
  console.log(` Serving assets from: ${DIST_PATH}`);
  console.log(`=======================================================`);
});
