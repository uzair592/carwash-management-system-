const prisma = require('../prisma');
const {
  sendTelegramMessage,
  sendSMSReceipt
} = require('../services/notification.service');
const F = require('../services/finance.service');
let timer = null,
  busy = false;
async function processOutboxQueue() {
  if (busy) return;
  busy = true;
  try {
    await prisma.alertOutbox.updateMany({
      where: {
        status: 'PROCESSING',
        next_attempt_at: {
          lte: new Date()
        }
      },
      data: {
        status: 'PENDING'
      }
    });
    const candidates = await prisma.alertOutbox.findMany({
      where: {
        status: {
          in: ['PENDING', 'FAILED']
        },
        next_attempt_at: {
          lte: new Date()
        }
      },
      orderBy: {
        created_at: 'asc'
      },
      take: 10
    });
    for (const alert of candidates) {
      const claim = await prisma.alertOutbox.updateMany({
        where: {
          id: alert.id,
          status: {
            in: ['PENDING', 'FAILED']
          }
        },
        data: {
          status: 'PROCESSING',
          attempts: {
            increment: 1
          },
          next_attempt_at: new Date(Date.now() + 120000)
        }
      });
      if (!claim.count) continue;
      try {
        const payload = typeof alert.payload === 'string' ? JSON.parse(alert.payload) : alert.payload;
        const result = alert.type === 'SMS' ? await sendSMSReceipt(payload.phone, payload.text) : await sendTelegramMessage(payload.text || payload.message);
        if (result.sent) {
          await prisma.alertOutbox.update({
            where: {
              id: alert.id
            },
            data: {
              status: 'SENT',
              processed_at: new Date(),
              error_message: null
            }
          });
        } else {
          await prisma.alertOutbox.update({
            where: {
              id: alert.id
            },
            data: {
              status: 'FAILED',
              error_message: result.error || result.reason || 'Delivery failed',
              next_attempt_at: new Date(Date.now() + Math.min(3600000, 5000 * 2 ** Math.min(alert.attempts || 0, 10)))
            }
          });
        }
      } catch (e) {
        await prisma.alertOutbox.update({
          where: {
            id: alert.id
          },
          data: {
            status: 'FAILED',
            error_message: e.message,
            next_attempt_at: new Date(Date.now() + 30000)
          }
        });
      }
    }
  } finally {
    busy = false;
  }
}
function initOutboxWorker() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => processOutboxQueue().catch(e => console.error('[Outbox]', e.message)), 5000);
}
function stopOutboxWorker() {
  clearInterval(timer);
  timer = null;
}
module.exports = {
  processOutboxQueue,
  initOutboxWorker,
  stopOutboxWorker
};
