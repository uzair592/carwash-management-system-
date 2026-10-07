require('dotenv').config();
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Track active FFmpeg child processes for clean resource termination
const activeFfmpegCommands = new Set();

/**
 * Returns default RTSP sub-stream URL from environment.
 * Target: Streaming/Channels/102 (Camera 1, Low-Res Sub-stream)
 */
function getDefaultRtspUrl() {
  if (process.env.HIKVISION_INGRESS_RTSP_STREAM) {
    return process.env.HIKVISION_INGRESS_RTSP_STREAM;
  }
  const ip = process.env.HIKVISION_NVR_IP || '192.168.1.64';
  const user = process.env.HIKVISION_NVR_USER || 'admin';
  const pass = process.env.HIKVISION_NVR_PASSWORD || 'SecureCameraPass123';
  return `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${ip}:554/Streaming/Channels/102`;
}

/**
 * Grabs exactly 1 frame from the Hikvision RTSP sub-stream.
 * Immediately terminates the FFmpeg process upon frame capture or timeout.
 *
 * @param {string} [rtspUrl] - Custom RTSP URL or falls back to env config
 * @param {string} [outputFilename] - Optional specific output filename
 * @param {number} [timeoutMs=5000] - Hard timeout in ms
 * @returns {Promise<{ success: boolean, imagePath: string, durationMs: number }>}
 */
function grabFrame(rtspUrl = getDefaultRtspUrl(), outputFilename, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const filename = outputFilename || `anpr_${Date.now()}.jpg`;
    const outputPath = path.join(TEMP_DIR, filename);

    let commandInstance = null;
    let isSettled = false;

    // Hard watchdog timer to eliminate zombie FFmpeg processes
    const watchdog = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        console.warn(`[FrameGrabber] RTSP snapshot timed out after ${timeoutMs}ms. Killing FFmpeg process.`);
        if (commandInstance) {
          try {
            commandInstance.kill('SIGKILL');
          } catch (_) {}
          activeFfmpegCommands.delete(commandInstance);
        }
        reject(new Error(`FFmpeg RTSP frame grab timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    try {
      commandInstance = ffmpeg(rtspUrl)
        .inputOptions([
          '-rtsp_transport tcp', // Enforce TCP for reliable packet delivery
          '-analyzeduration 1000000', // Limit probing to reduce latency
          '-probesize 1000000',
        ])
        .outputOptions([
          '-vframes 1', // Grab exactly 1 frame
          '-q:v 3', // High quality JPEG
        ])
        .output(outputPath)
        .on('start', (cmdline) => {
          activeFfmpegCommands.add(commandInstance);
        })
        .on('end', () => {
          clearTimeout(watchdog);
          if (!isSettled) {
            isSettled = true;
            activeFfmpegCommands.delete(commandInstance);
            const durationMs = Date.now() - startTime;
            resolve({
              success: true,
              imagePath: outputPath,
              durationMs,
            });
          }
        })
        .on('error', (err) => {
          clearTimeout(watchdog);
          if (!isSettled) {
            isSettled = true;
            activeFfmpegCommands.delete(commandInstance);
            reject(err);
          }
        });

      commandInstance.run();
    } catch (err) {
      clearTimeout(watchdog);
      if (!isSettled) {
        isSettled = true;
        reject(err);
      }
    }
  });
}

/**
 * Actively kills all running FFmpeg instances when camera module is disabled.
 */
function killActiveProcesses() {
  for (const cmd of activeFfmpegCommands) {
    try {
      cmd.kill('SIGKILL');
    } catch (_) {}
  }
  activeFfmpegCommands.clear();
}

module.exports = {
  grabFrame,
  killActiveProcesses,
  getDefaultRtspUrl,
  TEMP_DIR,
};
