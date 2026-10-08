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

// Redirect to the same-origin API host which serves the built UI and protected media.
app.use((req, res) => res.redirect(307, `http://${req.hostname.includes(':') ? '[' + req.hostname + ']' : req.hostname}:${process.env.API_PORT || 5000}${req.originalUrl}`));
app.listen(PORT, () => console.log(`UI entry redirects to shop API port ${process.env.API_PORT || 5000}`));
