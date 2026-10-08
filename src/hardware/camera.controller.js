require('dotenv').config();
const http = require('http');
const https = require('https');
const {
  getSetting,
  settingsEmitter
} = require('../services/settings.service');
const {
  grabFrame,
  killActiveProcesses
} = require('./frame-grabber');
const {
  recognizePlate,
  processPlateDetection
} = require('./ocr.service');
class CameraController {
  constructor() {
    this.isActive = false;
    this.isapiStream = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.buffer = '';

    // Bind lifecycle hook
    settingsEmitter.on('settingsUpdated', ({
      key,
      value
    }) => {
      if (key === 'ENABLE_CAMERA_ANPR') {
        if (value) {
          this.startListener();
        } else {
          this.stopListener();
        }
      }
    });
  }

  /**
   * Initializes controller on application startup.
   */
  init() {
    const shouldRun = getSetting('ENABLE_CAMERA_ANPR', false);
    if (shouldRun) {
      this.startListener();
    } else {
      console.log('[CameraController] Camera ANPR module is DISABLED via feature flag. Consuming 0% CPU/RAM.');
    }
  }

  /**
   * Opens persistent HTTP connection to Hikvision ISAPI alertStream.
   */
  startListener() {
    if (this.isapiStream) return;
    this.isActive = true;
    console.log('[CameraController] Starting Hikvision ISAPI Alert Stream Daemon...');
    const host = process.env.HIKVISION_NVR_IP || '192.168.1.64';
    const port = parseInt(process.env.HIKVISION_NVR_PORT || '80', 10);
    const user = process.env.HIKVISION_NVR_USER || 'admin';
    const pass = process.env.HIKVISION_NVR_PASSWORD || 'SecureCameraPass123';
    const authHeader = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    const options = {
      hostname: host,
      port: port,
      path: '/ISAPI/Event/notification/alertStream',
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Connection: 'keep-alive'
      },
      timeout: 10000
    };
    try {
      const req = http.request(options, res => {
        if (res.statusCode !== 200) {
          res.resume();
          req.destroy();
          this.isapiStream = null;
          this.scheduleReconnect();
          return;
        }
        console.log(`[CameraController] Connected to NVR alert stream (Status: ${res.statusCode}). Listening for LineDetection events...`);
        this.reconnectAttempts = 0;
        res.on('data', chunk => {
          if (!this.isActive) return;
          this.handleStreamData(chunk.toString());
        });
        res.on('end', () => {
          this.isapiStream = null;
          console.warn('[CameraController] NVR alert stream disconnected by remote server.');
          this.scheduleReconnect();
        });
        res.on('error', err => {
          console.warn('[CameraController] NVR stream response error:', err.message);
          this.scheduleReconnect();
        });
      });
      req.on('error', err => {
        this.isapiStream = null;
        console.warn(`[CameraController] Failed to connect to Hikvision NVR at ${host}:${port}: ${err.message}`);
        this.scheduleReconnect();
      });
      req.on('timeout', () => {
        console.warn('[CameraController] NVR stream connection timed out.');
        req.destroy();
        this.scheduleReconnect();
      });
      req.end();
      this.isapiStream = req;
    } catch (err) {
      console.error('[CameraController] Critical exception starting NVR listener:', err.message);
      this.scheduleReconnect();
    }
  }

  /**
   * Actively stops listeners, aborts network streams, and terminates child FFmpeg processes.
   * Guarantees zero CPU/RAM bloat when disabled.
   */
  stopListener() {
    console.log('[CameraController] Disabling Camera ANPR module. Reclaiming all hardware resources...');
    this.isActive = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.isapiStream) {
      try {
        this.isapiStream.destroy();
      } catch (_) {}
      this.isapiStream = null;
    }

    // Kill any active FFmpeg processes immediately
    killActiveProcesses();
    this.buffer = '';
    console.log('[CameraController] Module is now INACTIVE. 0 background processes.');
  }

  /**
   * Buffers stream chunks and parses multipart XML packets.
   */
  handleStreamData(chunk) {
    this.buffer += chunk;

    // Check for complete XML boundary / EventNotificationAlert tag
    const startIdx = this.buffer.indexOf('<EventNotificationAlert');
    const endIdx = this.buffer.indexOf('</EventNotificationAlert>');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const xmlPacket = this.buffer.substring(startIdx, endIdx + '</EventNotificationAlert>'.length);
      this.buffer = this.buffer.substring(endIdx + '</EventNotificationAlert>'.length);
      this.evaluateEvent(xmlPacket).catch(e => console.error('[Camera]', e.message));
      if (this.buffer.includes('</EventNotificationAlert>')) this.handleStreamData('');
    }

    // Prevent buffer memory bloat if corrupted
    if (this.buffer.length > 500000) {
      this.buffer = '';
    }
  }

  /**
   * Strictly filters for Ingress Line Crossing detection.
   * Ignores generic motion, and ignores exiting traffic.
   */
  async evaluateEvent(xml) {
    // 1. Strict Event Type Filter: linedetection / LineDetection
    const isLineDetection = /<eventType>(linedetection|LineDetection)<\/eventType>/i.test(xml);
    if (!isLineDetection) {
      return; // Ignore general motion or other alarms
    }

    // 2. Strict Direction Filter: Entry into wash bay
    // Hikvision line crossing indicates direction: e.g. "A->B", "direction: 0", or "in"
    // "B->A" or "direction: 1" indicates car exiting the bay
    const isExiting = /<(direction|Direction)>(B->A|out|reverse)<\/(direction|Direction)>/i.test(xml);
    if (isExiting) {
      console.log('[CameraController] LineCrossing ignored: Vehicle is EXITING bay.');
      return;
    }
    console.log('[CameraController] 🚨 INGRESS LineCrossing detected! Vehicle entering bay.');

    // 3. Trigger RTSP Sub-stream snapshot & Offline OCR
    try {
      const frameResult = await grabFrame();
      console.log(`[CameraController] Frame grabbed in ${frameResult.durationMs}ms: ${frameResult.imagePath}`);
      const ocrResult = await recognizePlate(frameResult.imagePath);
      console.log(`[CameraController] OCR Extracted Plate: "${ocrResult.plate}" (Confidence: ${ocrResult.confidence}%)`);
      await processPlateDetection(ocrResult.plate, frameResult.imagePath, ocrResult.confidence);
    } catch (err) {
      console.error('[CameraController] Ingress ANPR pipeline failed:', err.message);
    }
  }

  /**
   * Reconnect scheduler with exponential backoff (only runs while isActive is true).
   */
  scheduleReconnect() {
    if (!this.isActive) return;
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(30000, 3000 * Math.pow(1.5, this.reconnectAttempts - 1));
    console.log(`[CameraController] Will attempt NVR reconnection in ${(delay / 1000).toFixed(1)}s (Attempt #${this.reconnectAttempts})...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isActive) {
        this.isapiStream = null;
        this.startListener();
      }
    }, delay);
  }
}

// Export singleton instance
const cameraController = new CameraController();
module.exports = cameraController;
