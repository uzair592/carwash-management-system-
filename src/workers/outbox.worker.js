const prisma = require('../prisma');
const { sendTelegramMessage } = require('../services/notification.service');

let outboxInterval = null;
let isProcessing = false;

/**
 * Background worker processing pending alerts from the AlertOutbox table.
 * Runs on a 5-second polling loop.
 * Guarantees zero revenue leakage or checkout disruption if internet is offline.
 */
async function processOutboxQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pendingAlerts = await prisma.alertOutbox.findMany({
      where: { status: 'PENDING' },
      orderBy: { created_at: 'asc' },
      take: 10,
    });

    if (pendingAlerts.length === 0) {
      isProcessing = false;
      return;
    }

    for (const alert of pendingAlerts) {
      try {
        const payload = typeof alert.payload === 'string' ? JSON.parse(alert.payload) : alert.payload;
        const textMessage = payload.text || payload.message || JSON.stringify(payload);

        const dispatchResult = await sendTelegramMessage(textMessage);

        if (dispatchResult.sent) {
          await prisma.alertOutbox.update({
            where: { id: alert.id },
            data: {
              status: 'SENT',
              processed_at: new Date(),
            },
          });
          console.log(`[OutboxWorker] Alert ${alert.id} delivered successfully.`);
        } else if (dispatchResult.reason === 'FLAG_DISABLED') {
          // Feature flag disabled, mark as SENT/SKIPPED to avoid clogging
          await prisma.alertOutbox.update({
            where: { id: alert.id },
            data: {
              status: 'SENT',
              error_message: 'Skipped: Feature flag disabled',
              processed_at: new Date(),
            },
          });
        } else {
          await prisma.alertOutbox.update({
            where: { id: alert.id },
            data: {
              status: 'FAILED',
              error_message: dispatchResult.error || dispatchResult.reason || 'Failed to dispatch',
            },
          });
        }
      } catch (err) {
        console.error(`[OutboxWorker] Error dispatching alert ${alert.id}:`, err.message);
        await prisma.alertOutbox.update({
          where: { id: alert.id },
          data: {
            status: 'FAILED',
            error_message: err.message,
          },
        });
      }
    }
  } catch (err) {
    console.error('[OutboxWorker] Fatal error reading AlertOutbox table:', err.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Starts the Outbox worker polling every 5 seconds
 */
function initOutboxWorker() {
  if (outboxInterval) clearInterval(outboxInterval);
  outboxInterval = setInterval(processOutboxQueue, 5000);
  console.log('[OutboxWorker] Telegram Alert Outbox daemon initialized (5s poll loop).');
}

/**
 * Stops the Outbox worker
 */
function stopOutboxWorker() {
  if (outboxInterval) {
    clearInterval(outboxInterval);
    outboxInterval = null;
  }
}

module.exports = {
  initOutboxWorker,
  stopOutboxWorker,
  processOutboxQueue,
};
